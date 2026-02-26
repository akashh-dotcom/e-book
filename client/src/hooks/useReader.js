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
  const [highlightColor, setHighlightColorState] = useState('');
  const [translatedLang, setTranslatedLang] = useState(() => {
    if (!bookId) return null;
    return localStorage.getItem(`voxbook_lang_${bookId}`) || null;
  });
  const [translating, setTranslating] = useState(false);
  const [translateProgress, setTranslateProgress] = useState(0); // 0-100
  const chapterRef = useRef(null);
  // Skip the next useEffect chapter reload (set after translateTo completes)
  const skipNextLoad = useRef(false);

  // Persist translatedLang to localStorage
  useEffect(() => {
    if (!bookId) return;
    if (translatedLang) {
      localStorage.setItem(`voxbook_lang_${bookId}`, translatedLang);
    } else {
      localStorage.removeItem(`voxbook_lang_${bookId}`);
    }
  }, [bookId, translatedLang]);

  // Load book
  useEffect(() => {
    if (!bookId) return;
    setLoading(true);
    api.get(`/books/${bookId}`)
      .then(r => {
        setBook(r.data);
        if (r.data.highlightColor) setHighlightColorState(r.data.highlightColor);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [bookId]);

  const setHighlightColor = useCallback((color) => {
    setHighlightColorState(color);
    if (bookId) {
      api.patch(`/books/${bookId}/settings`, { highlightColor: color }).catch(() => {});
    }
  }, [bookId]);

  // Load chapter (original or translated)
  useEffect(() => {
    if (!book) return;

    // Skip if translateTo just set the HTML directly
    if (skipNextLoad.current) {
      skipNextLoad.current = false;
      return;
    }

    setChapterLoading(true);

    if (translatedLang) {
      // Load translated chapter (uses cache, no force)
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

  // Translate current chapter to a language (with polling progress)
  const translateTo = useCallback(async (targetLang) => {
    if (!targetLang) {
      setTranslatedLang(null);
      return;
    }
    setTranslating(true);
    setTranslateProgress(0);

    // Start polling for progress
    const pollInterval = setInterval(async () => {
      try {
        const r = await api.get(`/translate/${bookId}/${chapterIndex}/progress`);
        if (r.data && r.data.percent > 0) {
          setTranslateProgress(r.data.percent);
        }
      } catch {
        // ignore poll errors
      }
    }, 800);

    try {
      const res = await api.post(`/translate/${bookId}/${chapterIndex}`, {
        targetLang,
        force: true,
      }, { timeout: 600000 }); // 10 min for large chapters

      // Stop polling
      clearInterval(pollInterval);

      if (res.data.html) {
        // Set HTML directly and skip the useEffect reload
        skipNextLoad.current = true;
        setChapterHtml(res.data.html);
        setTranslatedLang(res.data.translated ? targetLang : null);
      }
    } catch {
      clearInterval(pollInterval);
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
    highlightColor,
    setHighlightColor,
    // Translation
    translatedLang,
    translating,
    translateProgress,
    translateTo,
    showOriginal,
  };
}
