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

  // Update user in state + localStorage (keeps existing token)
  setUser: (user) => {
    localStorage.setItem('voxbook_user', JSON.stringify(user));
    set({ user, error: null });
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

  // Profile actions
  updateProfile: async ({ username, email, phone }) => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.put('/auth/profile', { username, email, phone });
      get().setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Update failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  changePassword: async ({ currentPassword, newPassword }) => {
    set({ loading: true, error: null });
    try {
      await api.put('/auth/profile/password', { currentPassword, newPassword });
    } catch (err) {
      const msg = err.response?.data?.error || 'Password change failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  uploadAvatar: async (file) => {
    set({ loading: true, error: null });
    try {
      const form = new FormData();
      form.append('avatar', file);
      const { data } = await api.post('/auth/profile/avatar', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      get().setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Upload failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  removeAvatar: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.delete('/auth/profile/avatar');
      get().setUser(data.user);
      return data.user;
    } catch (err) {
      const msg = err.response?.data?.error || 'Failed to remove avatar';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
  },

  deleteAccount: async () => {
    set({ loading: true, error: null });
    try {
      await api.delete('/auth/profile');
      get().clearAuth();
    } catch (err) {
      const msg = err.response?.data?.error || 'Delete failed';
      set({ error: msg });
      throw new Error(msg);
    } finally {
      set({ loading: false });
    }
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
