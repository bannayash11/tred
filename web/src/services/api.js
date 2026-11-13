import axios from 'axios';
import { io } from 'socket.io-client';
import { getApiErrorMessage } from '../lib/apiError';

export { getApiErrorMessage };

const isLocalHost =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const envBackend = (import.meta.env.VITE_BACKEND_URL || '').replace(/\/$/, '');

// Localhost always uses local API (avoids Hostinger CORS). Production uses env or Hostinger.
const BACKEND_URL = isLocalHost
  ? envBackend && !envBackend.includes('hostingersite.com')
    ? envBackend
    : 'http://localhost:5001'
  : envBackend || 'https://violet-lark-104376.hostingersite.com';

const API_BASE = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'tred_auth_token';

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 25000,
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
      // Clear stale session on protected auth failures (not on public login attempts)
      if (
        !url.includes('/auth/login') &&
        !url.includes('/auth/register') &&
        !url.includes('/auth/admin-login') &&
        !url.includes('/auth/forgot-password') &&
        !url.includes('/auth/reset-password') &&
        !url.includes('/auth/verify-2fa')
      ) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tred_auth_user');
      }
    }
    error.userMessage = getApiErrorMessage(error);
    return Promise.reject(error);
  }
);

let socket = null;
export const getSocket = () => {
  const token = localStorage.getItem(TOKEN_KEY);
  // Recreate when auth token changes so Socket.io handshake carries JWT
  if (socket && socket.__authToken !== token) {
    socket.disconnect();
    socket = null;
  }
  if (!socket) {
    socket = io(BACKEND_URL || undefined, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnectionAttempts: 10,
      reconnectionDelay: 1000
    });
    socket.__authToken = token;
  }
  return socket;
};

export const fetchScreener = () => api.get('/screener/live').then((res) => res.data);
export const fetchMarketXRay = () => api.get('/screener/market-xray').then((res) => res.data);
export const fetchOpeningMomentum = () => api.get('/screener/opening-momentum').then((res) => res.data);
export const fetchDirectionalScanner = (params = {}) =>
  api.get('/directional-scanner/live', { params }).then((res) => res.data);
export const fetchAlphaMove2 = (params = {}) =>
  api.get('/alpha-move-2/live', { params }).then((res) => res.data);
export const fetchStock = (symbol, { timeframe = '5m', rangeDays = 30 } = {}) =>
  api
    .get(`/screener/stock/${encodeURIComponent(symbol)}`, {
      params: { tf: timeframe, range: rangeDays }
    })
    .then((res) => res.data);
export const fetchPublicAnnouncement = () => api.get('/admin/public-announcement').then((res) => res.data);

export const fetchTierRules = () => api.get('/content/tier-rules').then((res) => res.data);

export const fetchSeoPages = () => api.get('/seo/pages').then((res) => res.data);
export const fetchSeoByPath = (path) =>
  api.get('/seo/resolve', { params: { path } }).then((res) => res.data);

export const fetchCmsPages = () => api.get('/cms/pages').then((res) => res.data);
export const fetchCmsPage = (slug) => api.get(`/cms/pages/${slug}`).then((res) => res.data);

export const fetchPublicPlans = () => api.get('/admin/public-plans').then((res) => res.data);
export const fetchPublicSignupSettings = () =>
  api.get('/admin/public-signup-settings').then((res) => res.data);
export const activateMembershipApi = (data) =>
  api.post('/auth/activate-membership', data).then((res) => res.data);

/** Razorpay checkout */
export const createPaymentOrder = (data) =>
  api.post('/payment/create-order', data).then((res) => res.data);
export const verifyPaymentApi = (data) =>
  api.post('/payment/verify', data).then((res) => res.data);
export const markPaymentFailedApi = (data) =>
  api.post('/payment/failed', data).then((res) => res.data);
export const fetchMyPaymentHistory = (params = {}) =>
  api.get('/payment/my-history', { params }).then((res) => res.data);
export const cancelMembershipApi = (data = {}) =>
  api.post('/payment/cancel-membership', data).then((res) => res.data);
export const fetchByokStatusApi = () => api.get('/auth/byok').then((res) => res.data);
export const updateByokCredentialsApi = (byokCredentials) =>
  api.put('/auth/byok', { byokCredentials }).then((res) => res.data);

export const loginApi = (data) => api.post('/auth/login', data).then((res) => res.data);
export const registerSendOtpApi = (data) =>
  api.post('/auth/register/send-otp', data).then((res) => res.data);
export const registerApi = (data) => api.post('/auth/register', data).then((res) => res.data);
export const verify2faApi = (data) => api.post('/auth/verify-2fa', data).then((res) => res.data);
export const forgotPasswordApi = (data) => api.post('/auth/forgot-password', data).then((res) => res.data);
export const resetPasswordApi = (data) => api.post('/auth/reset-password', data).then((res) => res.data);
export const updatePasswordApi = (data) => api.post('/auth/update-password', data).then((res) => res.data);
export const toggle2FAApi = (data) => api.post('/auth/toggle-2fa', data).then((res) => res.data);
export const fetchSessionsApi = () => api.get('/auth/sessions').then((res) => res.data);
export const revokeSessionsApi = () => api.post('/auth/revoke-sessions').then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data);
