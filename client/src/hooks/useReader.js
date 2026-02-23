import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../services/api';

export default function useReader(bookId) {
  const [book, setBook] = useState(null);
  const [chapterHtml, setChapterHtml] = useState('');
  const [chapterIndex, setChapterIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [chapterLoading, setChapterLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [fontSize, setFontSize] = useState(18);
  const [lineHeight, setLineHeight] = useState(1.8);
  const [theme, setTheme] = useState('light');
  const [readingMode, setReadingMode] = useState('scroll');
  const [searchOpen, setSearchOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [bookmarksOpen, setBookmarksOpen] = useState(false);
  const [bookmarks, setBookmarks] = useState([]);
  const [translatedLang, setTranslatedLang] = useState(null); // null = original
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0); // 0-100
  const chapterRef = useRef(null);

  // Load book
  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    api.get(`/books/${bookId}`)
      .then(r => {
        setBook(r.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookId]);

  // Load chapter (original or translated)
  useEffect(() => {
    if (!book) return;
    setChapterLoading(true);

    if (translatedLang) {
      // Load translated chapter
      api.post(`/translate/${bookId}/${chapterIndex}`, { targetLang: translatedLang })
        .then(r => {
          setChapterHtml(r.data.html);
          setChapterLoading(false);
        })
        .catch(() => {
          // Fallback to original on error
          api.get(`/books/${bookId}/chapters/${chapterIndex}`)
            .then(r => { setChapterHtml(r.data.html); setChapterLoading(false); })
            .catch(() => setChapterLoading(false));
        });
    } else {
      api.get(`/books/${bookId}/chapters/${chapterIndex}`)
        .then(r => {
          setChapterHtml(r.data.html);
          setChapterLoading(false);
        })
        .catch(() => setChapterLoading(false));
    }
  }, [book, bookId, chapterIndex, translatedLang]);

  // Load bookmarks
  useEffect(() => {
    if (!bookId) return;
    api.get(`/books/bookmarks/${bookId}`)
      .then(r => setBookmarks(r.data))
      .catch(() => {});
  }, [bookId]);

  const goNext = useCallback(() => {
    if (book && chapterIndex < book.totalChapters - 1) {
      setChapterIndex(i => i + 1);
    }
  }, [book, chapterIndex]);

  const goPrev = useCallback(() => {
    if (chapterIndex > 0) {
      setChapterIndex(i => i - 1);
    }
  }, [chapterIndex]);

  const goToChapter = useCallback((index) => {
    setChapterIndex(index);
    setSearchOpen(false);
  }, []);

  const addBookmark = useCallback(async (data) => {
    try {
      const res = await api.post('/books/bookmarks', {
        bookId,
        chapterIndex,
        ...data,
      });
      setBookmarks(prev => [res.data, ...prev]);
      return res.data;
    } catch {
      return null;
    }
  }, [bookId, chapterIndex]);

  const removeBookmark = useCallback(async (id) => {
    try {
      await api.delete(`/books/bookmarks/item/${id}`);
      setBookmarks(prev => prev.filter(b => b._id !== id));
    } catch {
      // ignore
    }
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'ArrowRight') goNext();
      if (e.key === 'ArrowLeft') goPrev();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goNext, goPrev]);

  // Reload chapter (respects current translation state)
  const reloadChapter = useCallback(() => {
    if (!book || !bookId) return;
    setChapterLoading(true);

    if (translatedLang) {
      api.post(`/translate/${bookId}/${chapterIndex}`, { targetLang: translatedLang })
        .then(r => { setChapterHtml(r.data.html); setChapterLoading(false); })
        .catch(() => {
          api.get(`/books/${bookId}/chapters/${chapterIndex}`)
            .then(r => { setChapterHtml(r.data.html); setChapterLoading(false); })
            .catch(() => setChapterLoading(false));
        });
    } else {
      api.get(`/books/${bookId}/chapters/${chapterIndex}`)
        .then(r => { setChapterHtml(r.data.html); setChapterLoading(false); })
        .catch(() => setChapterLoading(false));
    }
  }, [book, bookId, chapterIndex, translatedLang]);

  // Translate current chapter to a language (with SSE progress)
  const translateTo = useCallback(async (targetLang) => {
    if (!targetLang) {
      setTranslatedLang(null);
      return;
    }
    setTranslating(true);
    setTranslateProgress(0);

    try {
      const token = localStorage.getItem('voxbook_token');
      const response = await fetch(`/api/translate/${bookId}/${chapterIndex}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ targetLang }),
      });

      const contentType = response.headers.get('content-type') || '';

      if (contentType.includes('text/event-stream')) {
        // SSE streaming response — read progress events
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop(); // keep incomplete line

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            try {
              const evt = JSON.parse(line.slice(6));
              if (evt.progress !== undefined) {
                setTranslateProgress(evt.progress);
              }
              if (evt.done) {
                setChapterHtml(evt.html);
                setTranslatedLang(targetLang);
              }
              if (evt.error) {
                throw new Error(evt.error);
              }
            } catch (parseErr) {
              if (parseErr.message && !parseErr.message.includes('JSON')) throw parseErr;
            }
          }
        }
      } else {
        // Regular JSON response (cached result or same-language)
        const data = await response.json();
        if (data.html) {
          setChapterHtml(data.html);
          setTranslatedLang(data.translated ? targetLang : null);
        }
      }
    } catch {
      // Stay on original
    } finally {
      setTranslating(false);
      setTranslateProgress(0);
    }
  }, [bookId, chapterIndex]);

  // Show original
  const showOriginal = useCallback(() => {
    setTranslatedLang(null);
  }, []);

  const turnPage = useCallback((direction) => {
    const container = chapterRef.current;
    if (!container) return;
    const pageWidth = container.clientWidth + 60;
    container.scrollTo({
      left: container.scrollLeft + (direction * pageWidth),
      behavior: 'smooth',
    });
  }, []);

  return {
    book,
    chapterHtml,
    chapterIndex,
    loading,
    chapterLoading,
    sidebarOpen,
    setSidebarOpen,
    fontSize,
    setFontSize,
    lineHeight,
    setLineHeight,
    theme,
    setTheme,
    readingMode,
    setReadingMode,
    searchOpen,
    setSearchOpen,
    settingsOpen,
    setSettingsOpen,
    bookmarksOpen,
    setBookmarksOpen,
    bookmarks,
    goNext,
    goPrev,
    goToChapter,
    addBookmark,
    removeBookmark,
    chapterRef,
    turnPage,
    reloadChapter,
    // Translation
    translatedLang,
    translating,
    translateProgress,
    translateTo,
    showOriginal,
  };
}
