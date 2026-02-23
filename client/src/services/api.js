import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
});

// Attach stored token on every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('voxbook_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
