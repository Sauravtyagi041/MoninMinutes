import axios from 'axios';

// Empty in development (Vite proxies /api). In production either leave empty and
// rewrite /api at the host, or set VITE_API_URL to the API origin.
const baseURL = (import.meta.env?.VITE_API_URL || '') + '/api';

export const api = axios.create({ baseURL, withCredentials: true, timeout: 60000 });

let csrfToken = null;
export const setCsrfToken = (t) => {
  csrfToken = t;
};

api.interceptors.request.use((config) => {
  if (csrfToken && !['get', 'head', 'options'].includes((config.method || 'get').toLowerCase())) {
    config.headers['X-CSRF-Token'] = csrfToken;
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const url = error.config?.url || '';
    if (error.response?.status === 401 && !url.startsWith('/auth/')) {
      window.dispatchEvent(new CustomEvent('mm:session-expired'));
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from any axios error. */
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (error?.response?.data?.error?.message) return error.response.data.error.message;
  if (error?.code === 'ECONNABORTED') return 'The request timed out. Please check your connection and try again.';
  if (error?.request && !error.response) return 'Cannot reach the server. Please check your connection and try again.';
  return fallback;
};

export const fieldErrors = (error) =>
  Object.fromEntries((error?.response?.data?.error?.details || []).map((d) => [d.field, d.message]));

const unwrap = (p) => p.then((r) => r.data);

export const auth = {
  register: (b) => unwrap(api.post('/auth/register', b)),
  login: (b) => unwrap(api.post('/auth/login', b)),
  logout: () => unwrap(api.post('/auth/logout')),
  me: () => unwrap(api.get('/auth/me')),
};
export const meetings = {
  list: (params) => unwrap(api.get('/meetings', { params })),
  create: (b) => unwrap(api.post('/meetings', b)),
  get: (id) => unwrap(api.get(`/meetings/${id}`)),
  update: (id, b) => unwrap(api.patch(`/meetings/${id}`, b)),
  remove: (id) => unwrap(api.delete(`/meetings/${id}`)),
  putTranscript: (id, b) => unwrap(api.post(`/meetings/${id}/transcript`, b)),
  uploadTranscript: (id, file) => {
    const form = new FormData();
    form.append('file', file);
    return unwrap(api.post(`/meetings/${id}/transcript`, form, { headers: { 'Content-Type': 'multipart/form-data' } }));
  },
  transcript: (id) => unwrap(api.get(`/meetings/${id}/transcript`)),
  generate: (id) => unwrap(api.post(`/meetings/${id}/generate`)),
  status: (id) => unwrap(api.get(`/meetings/${id}/processing-status`)),
  patchMinutes: (id, b) => unwrap(api.patch(`/meetings/${id}/minutes`, b)),
  exportFile: (id, format) => api.get(`/meetings/${id}/export`, { params: { format }, responseType: 'blob' }),
};
export const actions = {
  list: (params) => unwrap(api.get('/action-items', { params })),
  create: (meetingId, b) => unwrap(api.post(`/meetings/${meetingId}/action-items`, b)),
  update: (id, b) => unwrap(api.patch(`/action-items/${id}`, b)),
  remove: (id) => unwrap(api.delete(`/action-items/${id}`)),
};
export const dashboard = { stats: () => unwrap(api.get('/dashboard/stats')) };
export const health = () => unwrap(api.get('/health'));
