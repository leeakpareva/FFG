/**
 * API client.
 *
 * Same-origin: nginx proxies /api and /media to the ffg-api container, so
 * there is no CORS and no base URL to configure per environment.
 *
 * Every call carries the Clerk session token. The server verifies it — the
 * UI hiding a control is convenience, never the access control.
 */

/**
 * Where the API lives.
 *
 * Empty (the default) means same-origin, which is how the containerised
 * build runs — nginx proxies /api to ffg-api. The Vercel build sets
 * VITE_API_BASE to the public API host, because Vercel's functions and
 * static origin cannot reach the private network the database sits on.
 */
const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '');

/** Absolute URL for an uploaded asset, wherever the API is hosted. */
export const mediaUrl = (path) =>
  !path ? null : path.startsWith('http') ? path : `${API_BASE}${path}`;

const json = async (res) => {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.detail || body.error || `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
};

export function createApi(getToken) {
  const auth = async () => {
    const t = await getToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  return {
    /** Current member's profile, including whether they may publish to the Library. */
    async me() {
      return json(await fetch(`${API_BASE}/api/me`, { headers: await auth() }));
    },

    /**
     * Saves part of your own profile and returns the whole thing back.
     * Only the keys you send are changed — the server ignores everything it
     * does not allow a member to set, `is_admin` above all.
     */
    async updateProfile(patch) {
      return json(await fetch(`${API_BASE}/api/me`, {
        method: 'PATCH',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      }));
    },

    /**
     * Uploads one image. The file goes straight to our own API — the browser
     * never holds a storage credential, and the server re-checks the real
     * file type rather than trusting what the browser labelled it.
     */
    async uploadImage(file, { kind = 'post', alt } = {}) {
      const form = new FormData();
      form.append('file', file);
      form.append('kind', kind);
      if (alt) form.append('alt_text', alt);
      return json(await fetch(`${API_BASE}/api/media`, {
        method: 'POST',
        headers: await auth(),   // no Content-Type: the browser sets the boundary
        body: form,
      }));
    },

    /** The member directory — the real people, not sample content. */
    async listMembers() {
      return json(await fetch(`${API_BASE}/api/members`, { headers: await auth() }));
    },

    /** Live rooms with real presence counts. */
    async listRooms() {
      return json(await fetch(`${API_BASE}/api/rooms`, { headers: await auth() }));
    },

    async listArticles() {
      return json(await fetch(`${API_BASE}/api/articles`, { headers: await auth() }));
    },

    /** One article with its full body — fetched when the reader opens. */
    async getArticle(id) {
      return json(await fetch(`${API_BASE}/api/articles/${id}`, { headers: await auth() }));
    },

    async listEvents() {
      return json(await fetch(`${API_BASE}/api/events`, { headers: await auth() }));
    },

    async listReplays() {
      return json(await fetch(`${API_BASE}/api/replays`, { headers: await auth() }));
    },

    async listWorkshops() {
      return json(await fetch(`${API_BASE}/api/workshops`, { headers: await auth() }));
    },

    /** Signed, short-lived permission to play one replay's video. */
    async playReplay(id) {
      return json(await fetch(`${API_BASE}/api/replays/${id}/play`, { headers: await auth() }));
    },

    /** Presence ping — fire and forget, feeds the admin's time-in-app. */
    async ping() {
      await fetch(`${API_BASE}/api/presence`, { method: 'POST', headers: await auth() });
    },

    /** Free events only; paid ones go through eventCheckout. */
    async attendEvent(id) {
      return json(await fetch(`${API_BASE}/api/events/${id}/attend`, {
        method: 'POST', headers: await auth(),
      }));
    },

    /** Returns { checkout_url } for a priced event. */
    async eventCheckout(id) {
      return json(await fetch(`${API_BASE}/api/events/${id}/checkout`, {
        method: 'POST', headers: await auth(),
      }));
    },

    /* ------------------------------------------------------------ social */

    async listPosts() {
      return json(await fetch(`${API_BASE}/api/posts`, { headers: await auth() }));
    },

    async createPost({ body, pillar, image_key }) {
      return json(await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, pillar, image_key }),
      }));
    },

    /** Toggle. Returns { likes, liked } — the server's count is the truth. */
    async likePost(id) {
      return json(await fetch(`${API_BASE}/api/posts/${id}/like`, {
        method: 'POST', headers: await auth(),
      }));
    },

    /** Toggle. Returns { following }. */
    async followMember(id) {
      return json(await fetch(`${API_BASE}/api/members/${id}/follow`, {
        method: 'POST', headers: await auth(),
      }));
    },

    async listThreads() {
      return json(await fetch(`${API_BASE}/api/threads`, { headers: await auth() }));
    },

    /** Get-or-create the DM thread with another member. */
    async openThread(member_id) {
      return json(await fetch(`${API_BASE}/api/threads`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id }),
      }));
    },

    async listMessages(threadId) {
      return json(await fetch(`${API_BASE}/api/threads/${threadId}/messages`, { headers: await auth() }));
    },

    async sendMessage(threadId, body) {
      return json(await fetch(`${API_BASE}/api/threads/${threadId}/messages`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }));
    },

    /**
     * Asks the Connect Concierge. The model call happens on our server, so
     * no provider key ever reaches the browser and the system prompt cannot
     * be read or rewritten by the client.
     */
    async askConcierge(messages) {
      return json(await fetch(`${API_BASE}/api/concierge`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages }),
      }));
    },

    /** Admin only — the server rejects non-admins with 403. */
    async publishArticle(article) {
      return json(await fetch(`${API_BASE}/api/articles`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
      }));
    },
  };
}

/** Client-side guard rails, mirrored server-side. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;          // images
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;          // video clips
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';
export const ACCEPTED_VIDEO_TYPES = 'video/mp4,video/webm,video/quicktime';
export const ACCEPTED_MEDIA_TYPES = `${ACCEPTED_IMAGE_TYPES},${ACCEPTED_VIDEO_TYPES}`;

export const isVideoFile = (file) => ACCEPTED_VIDEO_TYPES.split(',').includes(file?.type);
export const isVideoUrl = (url) => /\.(mp4|webm|mov)($|\?)/i.test(url || '');

export function validateImage(file) {
  if (!file) return 'No file selected.';
  if (!ACCEPTED_IMAGE_TYPES.split(',').includes(file.type)) {
    return 'That file type is not supported. Use JPEG, PNG, WebP or GIF.';
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 8MB.`;
  }
  return null;
}

/** Photos and video clips both welcome — different caps for each. */
export function validateMedia(file) {
  if (!file) return 'No file selected.';
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      return `That video is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 60MB.`;
    }
    return null;
  }
  return validateImage(file);
}
