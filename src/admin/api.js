/**
 * Admin API client. The token comes from /api/admin/login and lives in
 * sessionStorage — closing the tab ends the session, which is the right
 * default for a back office.
 */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const KEY = 'ffg.admin.token';

export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);

class ApiError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

async function call(path, { method = 'GET', body, form } = {}) {
  const headers = { Authorization: `Bearer ${getToken()}` };
  if (body) headers['Content-Type'] = 'application/json';
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: form || (body ? JSON.stringify(body) : undefined),
  });
  if (res.status === 401 && !path.endsWith('/login')) {
    clearToken();
    window.location.reload(); // token expired mid-session: back to the login
    throw new ApiError('session expired', 401);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.detail || data.error || `request failed (${res.status})`, res.status);
  return data;
}

export const api = {
  async login(username, password) {
    const res = await fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(data.error || 'login failed', res.status);
    setToken(data.token);
  },

  overview: () => call('/api/admin/stats/overview'),
  activity: (days = 30) => call(`/api/admin/stats/activity?days=${days}`),
  roomStats: () => call('/api/admin/stats/rooms'),
  revenue: () => call('/api/admin/stats/revenue'),

  timespent: (days = 14) => call(`/api/admin/stats/timespent?days=${days}`),
  engagement: () => call('/api/admin/stats/engagement'),

  members: () => call('/api/admin/members'),
  memberInsight: (id) => call(`/api/admin/members/${id}/insight`),
  messageMember: (id, body) => call(`/api/admin/members/${id}/message`, { method: 'POST', body: { body } }),
  updateMember: (id, patch) => call(`/api/admin/members/${id}`, { method: 'PATCH', body: patch }),
  inviteMember: (body) => call('/api/admin/members', { method: 'POST', body }),
  deleteMember: (id) => call(`/api/admin/members/${id}`, { method: 'DELETE' }),

  uploadMedia(file) {
    const form = new FormData();
    form.append('file', file);
    return call('/api/admin/media', { method: 'POST', form });
  },

  articles: () => call('/api/admin/articles'),
  createArticle: (body) => call('/api/admin/articles', { method: 'POST', body }),
  setArticleDraft: (id, is_draft) => call(`/api/admin/articles/${id}`, { method: 'PATCH', body: { is_draft } }),
  deleteArticle: (id) => call(`/api/admin/articles/${id}`, { method: 'DELETE' }),

  events: () => call('/api/admin/events'),
  createEvent: (body) => call('/api/admin/events', { method: 'POST', body }),
  deleteEvent: (id) => call(`/api/admin/events/${id}`, { method: 'DELETE' }),

  replays: () => call('/api/admin/replays'),
  createReplay: (body) => call('/api/admin/replays', { method: 'POST', body }),
  setReplayPublished: (id, published) => call(`/api/admin/replays/${id}`, { method: 'PATCH', body: { published } }),
  deleteReplay: (id) => call(`/api/admin/replays/${id}`, { method: 'DELETE' }),
  replayUploadUrl: (id) => call(`/api/admin/replays/${id}/video`, { method: 'POST' }),
  replayVideoStatus: (id) => call(`/api/admin/replays/${id}/video`),

  workshops: () => call('/api/admin/workshops'),
  createWorkshop: (body) => call('/api/admin/workshops', { method: 'POST', body }),
  updateWorkshop: (id, patch) => call(`/api/admin/workshops/${id}`, { method: 'PATCH', body: patch }),
  deleteWorkshop: (id) => call(`/api/admin/workshops/${id}`, { method: 'DELETE' }),

  payments: () => call('/api/admin/payments'),
  createPayment: (body) => call('/api/admin/payments', { method: 'POST', body }),
  recordManualPayment: (body) => call('/api/admin/payments/manual', { method: 'POST', body }),
  setPaymentStatus: (id, status) => call(`/api/admin/payments/${id}`, { method: 'PATCH', body: { status } }),
  paymentsCsvUrl: () => `${API_BASE}/api/admin/payments.csv`,
};
