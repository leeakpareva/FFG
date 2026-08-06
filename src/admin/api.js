/**
 * Admin API client. The token comes from /api/admin/login and lives in
 * sessionStorage — closing the tab ends the session, which is the right
 * default for a back office.
 */
export const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

const KEY = 'ffg.admin.token';

export const getToken = () => sessionStorage.getItem(KEY);
export const setToken = (t) => sessionStorage.setItem(KEY, t);
export const clearToken = () => sessionStorage.removeItem(KEY);

/**
 * Who is signed in, from the token itself: { username, name, role, scopes }.
 * The server re-checks every call — this only drives what the UI shows.
 */
export function whoAmI() {
  const t = getToken();
  if (!t) return null;
  try {
    const claims = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return {
      username: claims.sub || 'admin',
      name: claims.name || claims.sub || 'Admin',
      role: claims.role,
      scopes: claims.role === 'superadmin' ? ['*'] : (claims.scopes || []),
    };
  } catch {
    return null;
  }
}

export const can = (scope) => {
  const me = whoAmI();
  return !!me && (me.scopes.includes('*') || me.scopes.includes(scope));
};

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

  applications: (status) => call(`/api/admin/applications${status ? `?status=${status}` : ''}`),
  approveApplication: (id) => call(`/api/admin/applications/${id}/approve`, { method: 'POST' }),
  rejectApplication: (id) => call(`/api/admin/applications/${id}/reject`, { method: 'POST' }),
  shortlistApplication: (id) => call(`/api/admin/applications/${id}/shortlist`, { method: 'POST' }),
  unshortlistApplication: (id) => call(`/api/admin/applications/${id}/unshortlist`, { method: 'POST' }),
  assignApplication: (id, assigned_to) => call(`/api/admin/applications/${id}`, { method: 'PATCH', body: { assigned_to } }),
  addApplicationNote: (id, text) => call(`/api/admin/applications/${id}/notes`, { method: 'POST', body: { text } }),
  reviewers: () => call('/api/admin/reviewers'),
  marketingFunnel: () => call('/api/admin/marketing/funnel'),

  siteContent: () => call('/api/admin/site-content'),
  saveSiteContent: (key, value) => call(`/api/admin/site-content/${key}`, { method: 'PUT', body: { value } }),
  resetSiteContent: (key) => call(`/api/admin/site-content/${key}`, { method: 'DELETE' }),

  uploadMedia(file) {
    const form = new FormData();
    form.append('file', file);
    return call('/api/admin/media', { method: 'POST', form });
  },

  team: () => call('/api/admin/team'),
  createTeamMember: (body) => call('/api/admin/team', { method: 'POST', body }),
  updateTeamMember: (username, patch) => call(`/api/admin/team/${username}`, { method: 'PATCH', body: patch }),
  deleteTeamMember: (username) => call(`/api/admin/team/${username}`, { method: 'DELETE' }),

  campaigns: () => call('/api/admin/marketing/campaigns'),
  createCampaign: (body) => call('/api/admin/marketing/campaigns', { method: 'POST', body }),
  updateCampaign: (id, patch) => call(`/api/admin/marketing/campaigns/${id}`, { method: 'PATCH', body: patch }),
  deleteCampaign: (id) => call(`/api/admin/marketing/campaigns/${id}`, { method: 'DELETE' }),

  marketingAssets: (campaignId) => call(`/api/admin/marketing/assets${campaignId ? `?campaign_id=${campaignId}` : ''}`),
  uploadMarketingAsset(file, { title, tags, campaign_id } = {}) {
    const form = new FormData();
    form.append('file', file);
    if (title) form.append('title', title);
    if (tags) form.append('tags', tags);
    if (campaign_id) form.append('campaign_id', campaign_id);
    return call('/api/admin/marketing/assets', { method: 'POST', form });
  },
  updateMarketingAsset: (id, patch) => call(`/api/admin/marketing/assets/${id}`, { method: 'PATCH', body: patch }),
  deleteMarketingAsset: (id) => call(`/api/admin/marketing/assets/${id}`, { method: 'DELETE' }),

  articles: () => call('/api/admin/articles'),
  createArticle: (body) => call('/api/admin/articles', { method: 'POST', body }),
  setArticleDraft: (id, is_draft) => call(`/api/admin/articles/${id}`, { method: 'PATCH', body: { is_draft } }),
  deleteArticle: (id) => call(`/api/admin/articles/${id}`, { method: 'DELETE' }),

  events: () => call('/api/admin/events'),
  eventAttendees: (id) => call(`/api/admin/events/${id}/attendees`),
  createEvent: (body) => call('/api/admin/events', { method: 'POST', body }),
  deleteEvent: (id) => call(`/api/admin/events/${id}`, { method: 'DELETE' }),

  replays: () => call('/api/admin/replays'),
  createReplay: (body) => call('/api/admin/replays', { method: 'POST', body }),
  setReplayPublished: (id, published) => call(`/api/admin/replays/${id}`, { method: 'PATCH', body: { published } }),
  deleteReplay: (id) => call(`/api/admin/replays/${id}`, { method: 'DELETE' }),
  replayVideoStatus: (id) => call(`/api/admin/replays/${id}/video`),

  /**
   * Chunked replay upload: Cloudflare caps one request at ~100MB, replay
   * files are bigger, so the file travels in sequential 32MB parts and the
   * API assembles and stores it. onProgress gets 0..100.
   */
  async uploadReplayVideo(id, file, onProgress) {
    const { upload_id, chunk_bytes } = await call(`/api/admin/replays/${id}/video/begin`, { method: 'POST' });
    const parts = Math.max(1, Math.ceil(file.size / chunk_bytes));
    for (let i = 0; i < parts; i++) {
      const blob = file.slice(i * chunk_bytes, Math.min((i + 1) * chunk_bytes, file.size));
      const res = await fetch(`${API_BASE}/api/admin/replays/${id}/video/part/${upload_id}/${i}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${getToken()}`, 'Content-Type': 'application/octet-stream' },
        body: blob,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new ApiError(data.error || `part ${i + 1}/${parts} failed (${res.status})`, res.status);
      }
      onProgress?.(Math.round(((i + 1) / parts) * 95)); // the last 5% is the store
    }
    const done = await call(`/api/admin/replays/${id}/video/finish`, { method: 'POST', body: { upload_id } });
    onProgress?.(100);
    return done;
  },

  workshops: () => call('/api/admin/workshops'),
  createWorkshop: (body) => call('/api/admin/workshops', { method: 'POST', body }),
  updateWorkshop: (id, patch) => call(`/api/admin/workshops/${id}`, { method: 'PATCH', body: patch }),
  deleteWorkshop: (id) => call(`/api/admin/workshops/${id}`, { method: 'DELETE' }),

  rooms: () => call('/api/admin/rooms'),
  createRoom: (body) => call('/api/admin/rooms', { method: 'POST', body }),
  updateRoom: (id, patch) => call(`/api/admin/rooms/${id}`, { method: 'PATCH', body: patch }),
  deleteRoom: (id) => call(`/api/admin/rooms/${id}`, { method: 'DELETE' }),

  payments: () => call('/api/admin/payments'),
  createPayment: (body) => call('/api/admin/payments', { method: 'POST', body }),
  recordManualPayment: (body) => call('/api/admin/payments/manual', { method: 'POST', body }),
  setPaymentStatus: (id, status) => call(`/api/admin/payments/${id}`, { method: 'PATCH', body: { status } }),
  paymentsCsvUrl: () => `${API_BASE}/api/admin/payments.csv`,
};
