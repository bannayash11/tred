import axios from 'axios';
import { io } from 'socket.io-client';
import { getApiErrorMessage } from '../lib/apiError';

export { getApiErrorMessage };

const BACKEND_URL =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://localhost:5001'
    : '';

const API_BASE = `${BACKEND_URL}/api`;
const TOKEN_KEY = 'tred_admin_token';

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
      if (!url.includes('/auth/admin-login') && !url.includes('/auth/login') && !url.includes('/auth/forgot-password')) {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem('tred_admin_user');
      }
    }
    error.userMessage = getApiErrorMessage(error);
    return Promise.reject(error);
  }
);

let socket = null;
export const getSocket = () => {
  const token = localStorage.getItem(TOKEN_KEY);
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

export const fetchAdminData = () => api.get('/admin/overview').then((res) => res.data);
export const updateUserSub = (id, data) => api.post(`/admin/users/${id}/subscription`, data).then((res) => res.data);
export const updateBrokerConfig = (data) => api.post('/admin/settings/broker', data).then((res) => res.data);
export const updateAnnouncementConfig = (data) => api.post('/admin/settings/announcement', data).then((res) => res.data);
export const updateByokSalesConfig = (data) => api.post('/admin/settings/byok', data).then((res) => res.data);
export const updateFreeTrialConfig = (data) =>
  api.post('/admin/settings/free-trial', data).then((res) => res.data);
export const updatePaymentMethodsConfig = (data) =>
  api.post('/admin/settings/payments', data).then((res) => res.data);
export const updateUtrPayConfig = (data) =>
  api.post('/admin/settings/utr-config', data).then((res) => res.data);
export const uploadUtrQrImage = (data) =>
  api.post('/admin/settings/utr-qr-upload', data).then((res) => res.data);

// Opening 5-Minute Momentum Scanner API
export const fetchOpeningMomentumSettings = () => api.get('/admin/opening-momentum/settings').then((res) => res.data);
export const updateOpeningMomentumSettings = (data) => api.put('/admin/opening-momentum/settings', data).then((res) => res.data);
export const triggerOpeningMomentumFreeze = () => api.post('/admin/opening-momentum/trigger-freeze').then((res) => res.data);
export const resetOpeningMomentumSession = () => api.post('/admin/opening-momentum/reset').then((res) => res.data);
export const archiveOpeningMomentumSession = (force = false) =>
  api.post('/admin/opening-momentum/archive', { force }).then((res) => res.data);
export const fetchOpeningMomentumLive = () => api.get('/screener/opening-momentum').then((res) => res.data);

export const fetchSeoAdminPages = () => api.get('/seo/admin/pages').then((res) => res.data);
export const updateSeoAdminPage = (pageKey, data) =>
  api.put(`/seo/admin/pages/${pageKey}`, data).then((res) => res.data);
export const seedSeoAdminPages = () => api.post('/seo/admin/seed').then((res) => res.data);

export const adminLoginApi = (data) => api.post('/auth/admin-login', data).then((res) => res.data);
export const getMe = () => api.get('/auth/me').then((res) => res.data);

/** Razorpay + UTR admin payment tracking */
export const fetchAdminPayments = (params = {}) =>
  api.get('/payment/admin/all', { params }).then((res) => res.data);
export const importAdminPaymentsApi = (payments) =>
  api.post('/payment/admin/import', { payments }).then((res) => res.data);
export const approveUtrPaymentApi = (id, data = {}) =>
  api.post(`/payment/admin/${id}/approve-utr`, data).then((res) => res.data);
export const rejectUtrPaymentApi = (id, data = {}) =>
  api.post(`/payment/admin/${id}/reject-utr`, data).then((res) => res.data);

export const importAdminUsersApi = (users) =>
  api.post('/admin/users/import', { users }).then((res) => res.data);

export const fetchSmtpSettingsApi = () =>
  api.get('/admin/settings/smtp').then((res) => res.data);
export const saveSmtpSettingsApi = (data) =>
  api.post('/admin/settings/smtp', data).then((res) => res.data);
export const testSmtpSettingsApi = (data) =>
  api.post('/admin/settings/smtp/test', data).then((res) => res.data);

export const fetchEmailTemplatesApi = () =>
  api.get('/admin/settings/email-templates').then((res) => res.data);
export const saveEmailTemplateApi = (key, data) =>
  api.put(`/admin/settings/email-templates/${key}`, data).then((res) => res.data);
export const resetEmailTemplateApi = (key) =>
  api.post(`/admin/settings/email-templates/${key}/reset`).then((res) => res.data);
export const previewEmailTemplateApi = (key) =>
  api.post(`/admin/settings/email-templates/${key}/preview`).then((res) => res.data);

export const fetchSocialSettingsApi = () =>
  api.get('/admin/settings/social').then((res) => res.data);
export const saveSocialSettingsApi = (data) =>
  api.post('/admin/settings/social', data).then((res) => res.data);
export const fetchPublicSocialApi = () =>
  api.get('/admin/public-social').then((res) => res.data);
