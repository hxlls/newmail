import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me')
};

export const mailboxAPI = {
  getAll: () => api.get('/mailboxes'),
  create: (data) => api.post('/mailboxes', data),
  update: (id, data) => api.put(`/mailboxes/${id}`, data),
  delete: (id) => api.delete(`/mailboxes/${id}`),
  setDefault: (id) => api.put(`/mailboxes/${id}/default`),
  test: (data) => api.post('/mailboxes/test', data),
  getProviders: () => api.get('/mailboxes/providers'),
  detectProvider: (email) => api.get('/mailboxes/providers/detect', { params: { email } }),
  getUnified: (params) => api.get('/mailboxes/unified', { params }),
  getStats: () => api.get('/mailboxes/unified/stats')
};

export const emailAPI = {
  getAll: (params) => api.get('/emails', { params }),
  sync: (data) => api.post('/emails/sync', data),
  getById: (id) => api.get(`/emails/${id}`),
  send: (data) => api.post('/emails/send', data),
  markRead: (id, read) => api.put(`/emails/${id}/read`, { read }),
  markStarred: (id, starred) => api.put(`/emails/${id}/star`, { starred }),
  delete: (id) => api.delete(`/emails/${id}`)
};

export const aiAPI = {
  getConfigs: () => api.get('/ai/configs'),
  createConfig: (data) => api.post('/ai/configs', data),
  updateConfig: (id, data) => api.put(`/ai/configs/${id}`, data),
  deleteConfig: (id) => api.delete(`/ai/configs/${id}`),
  chat: (data) => api.post('/ai/chat', data),
  summarize: (data) => api.post('/ai/summarize', data),
  generateReply: (data) => api.post('/ai/reply', data)
};

export default api;
