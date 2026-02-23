import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('voxbook_user') || 'null'),
  token: localStorage.getItem('voxbook_token') || null,
  loading: false,
  error: null,

  setAuth: (user, token) => {
    localStorage.setItem('voxbook_user', JSON.stringify(user));
    localStorage.setItem('voxbook_token', token);
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    set({ user, token, error: null });
  },

  clearAuth: () => {
    localStorage.removeItem('voxbook_user');
    localStorage.removeItem('voxbook_token');
    delete api.defaults.headers.common['Authorization'];
    set({ user: null, token: null, error: null });
  },

  signup: async ({ username, email, phone, password }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/signup', { username, email, phone, password });
      get().setAuth(data.user, data.token);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Signup failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  userLogin: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/login', { email, password });
      get().setAuth(data.user, data.token);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Login failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  adminLogin: async ({ email, password }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.post('/auth/admin/login', { email, password });
      get().setAuth(data.user, data.token);
      return data;
    } catch (err) {
      const msg = err.response?.data?.error || 'Invalid admin credentials';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  logout: () => {
    get().clearAuth();
  },

  // Hydrate token on app start
  hydrate: () => {
    const token = localStorage.getItem('voxbook_token');
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  },
}));

export default useAuthStore;
