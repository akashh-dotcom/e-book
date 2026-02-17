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

  // Load chapter
  useEffect(() => {
    if (!book) return;
    setChapterLoading(true);
    api.get(`/books/${bookId}/chapters/${chapterIndex}`)
      .then(r => {
        setChapterHtml(r.data.html);
        setChapterLoading(false);
      })
      .catch(() => setChapterLoading(false));
  }, [book, bookId, chapterIndex]);

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

  // Paginated mode page turn
  const reloadChapter = useCallback(() => {
    if (!book || !bookId) return;
    setChapterLoading(true);
    api.get(`/books/${bookId}/chapters/${chapterIndex}`)
      .then(r => {
        setChapterHtml(r.data.html);
        setChapterLoading(false);
      })
      .catch(() => setChapterLoading(false));
  }, [book, bookId, chapterIndex]);

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
  };
}
