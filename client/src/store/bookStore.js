import { create } from 'zustand';
import api from '../services/api';

const useBookStore = create((set, get) => ({
  books: [],
  currentBook: null,
  loading: false,
  error: null,

  fetchBooks: async () => {
    set({ loading: true });
    try {
      const res = await api.get('/books');
      set({ books: res.data, loading: false });
    } catch (err) {
      set({ error: err.message, loading: false });
    }
  },

  fetchBook: async (id) => {
    set({ loading: true });
    try {
      const res = await api.get(`/books/${id}`);
      set({ currentBook: res.data, loading: false });
      return res.data;
    } catch (err) {
      set({ error: err.message, loading: false });
      return null;
    }
  },

  uploadBook: async (file, onProgress) => {
    const formData = new FormData();
    formData.append('epub', file);
    try {
      const res = await api.post('/books/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      });
      const { books } = get();
      set({ books: [res.data, ...books] });
      return res.data;
    } catch (err) {
      throw err;
    }
  },

  deleteBook: async (id) => {
    await api.delete(`/books/${id}`);
    const { books } = get();
    set({ books: books.filter(b => b._id !== id) });
  },
}));

export default useBookStore;
