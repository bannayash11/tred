import axios from 'axios';
import { io } from 'socket.io-client';

const BACKEND_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : '';

const API_BASE = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'tred_admin_token';

export const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || '';
      if (!url.includes('/auth/admin-login') && !url.includes('/auth/login') && !url.includes('/auth/forgot-password')) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tred_admin_user');
      }
    }
    return Promise.reject(error);
  }
);

let socket = null;
export const getSocket = () => {
  if (!socket) {
    socket = io(BACKEND_URL || undefined, {
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
  }
  return socket;
};

export const fetchScreener = () => api.get('/screener/live').then((res) => res.data);
export const fetchMarketXRay = () => api.get('/screener/market-xray').then((res) => res.data);
export const fetchStock = (symbol) => api.get(`/screener/stock/${symbol}`).then((res) => res.data);
export const fetchPublicAnnouncement = () => api.get('/admin/public-announcement').then((res) => res.data);

export const fetchJournal = () => api.get('/journal').then((res) => res.data);
export const createTrade = (tradeData) => api.post('/journal', tradeData).then((res) => res.data);
export const removeTrade = (id) => api.delete(`/journal/${id}`).then((res) => res.data);

export const fetchAdminData = () => api.get('/admin/overview').then((res) => res.data);
export const updateUserSub = (id, data) => api.post(`/admin/users/${id}/subscription`, data).then((res) => res.data);
export const updateBrokerConfig = (data) => api.post('/admin/settings/broker', data).then((res) => res.data);
export const updateAnnouncementConfig = (data) => api.post('/admin/settings/announcement', data).then((res) => res.data);

// Opening 5-Minute Momentum Scanner API
export const fetchOpeningMomentumSettings = () => api.get('/admin/opening-momentum/settings').then((res) => res.data);
export const updateOpeningMomentumSettings = (data) => api.put('/admin/opening-momentum/settings', data).then((res) => res.data);
export const triggerOpeningMomentumFreeze = () => api.post('/admin/opening-momentum/trigger-freeze').then((res) => res.data);
export const resetOpeningMomentumSession = () => api.post('/admin/opening-momentum/reset').then((res) => res.data);
export const fetchOpeningMomentumLive = () => api.get('/screener/opening-momentum').then((res) => res.data);

export const fetchSeoAdminPages = () => api.get('/seo/admin/pages').then((res) => res.data);
export const updateSeoAdminPage = (pageKey, data) =>
  api.put(`/seo/admin/pages/${pageKey}`, data).then((res) => res.data);
export const seedSeoAdminPages = () => api.post('/seo/admin/seed').then((res) => res.data);

export const loginApi = (data) => api.post('/auth/login', data).then((res) => res.data);
export const adminLoginApi = (data) => api.post('/auth/admin-login', data).then((res) => res.data);
export const registerApi = (data) => api.post('/auth/register', data).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data);
