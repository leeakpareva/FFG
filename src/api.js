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

    /**
     * Big videos travel in sequential 32MB parts (Cloudflare caps one
     * request at ~100MB) and are assembled server-side. onProgress: 0..100.
     */
    async uploadVideo(file, onProgress) {
      const begin = await json(await fetch(`${API_BASE}/api/media/video/begin`, {
        method: 'POST', headers: await auth(),
      }));
      const { upload_id, chunk_bytes } = begin;
      const parts = Math.max(1, Math.ceil(file.size / chunk_bytes));
      for (let i = 0; i < parts; i++) {
        const blob = file.slice(i * chunk_bytes, Math.min((i + 1) * chunk_bytes, file.size));
        const res = await fetch(`${API_BASE}/api/media/video/part/${upload_id}/${i}`, {
          method: 'PUT',
          headers: { ...(await auth()), 'Content-Type': 'application/octet-stream' },
          body: blob,
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || `part ${i + 1}/${parts} failed`);
        }
        onProgress?.(Math.round(((i + 1) / parts) * 95)); // the last 5% is the store
      }
      const done = await json(await fetch(`${API_BASE}/api/media/video/finish`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ upload_id }),
      }));
      onProgress?.(100);
      return done;
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

    /** Article engagement — same contracts as posts. */
    async likeArticle(id) {
      return json(await fetch(`${API_BASE}/api/articles/${id}/like`, { method: 'POST', headers: await auth() }));
    },
    async articleComments(id) {
      return json(await fetch(`${API_BASE}/api/articles/${id}/comments`, { headers: await auth() }));
    },
    async addArticleComment(id, body) {
      return json(await fetch(`${API_BASE}/api/articles/${id}/comments`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }));
    },
    async deleteArticleComment(id) {
      const res = await fetch(`${API_BASE}/api/articles/comments/${id}`, { method: 'DELETE', headers: await auth() });
      if (!res.ok && res.status !== 204) throw new Error(`delete failed (${res.status})`);
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

    /** Who's going: real attendees for the event page. */
    async eventAttendees(id) {
      return json(await fetch(`${API_BASE}/api/events/${id}/attendees`, { headers: await auth() }));
    },

    /* -------------------------------------------------------------- push */

    async pushKey() {
      return json(await fetch(`${API_BASE}/api/push/key`, { headers: await auth() }));
    },

    async pushSubscribe(subscription) {
      return json(await fetch(`${API_BASE}/api/push/subscribe`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      }));
    },

    /* ------------------------------------------------------------ social */

    async listPosts() {
      return json(await fetch(`${API_BASE}/api/posts`, { headers: await auth() }));
    },

    async createPost({ body, pillar, image_key, poster_key, tags }) {
      return json(await fetch(`${API_BASE}/api/posts`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body, pillar, image_key, poster_key, tags }),
      }));
    },

    /** A member's own posts — feeds the profile grid. */
    async memberPosts(id) {
      return json(await fetch(`${API_BASE}/api/members/${id}/posts`, { headers: await auth() }));
    },

    /** Posts a member is tagged in — the profile's second tab. */
    async memberTagged(id) {
      return json(await fetch(`${API_BASE}/api/members/${id}/tagged`, { headers: await auth() }));
    },

    /** Toggle. Returns { likes, liked } — the server's count is the truth. */
    async likePost(id) {
      return json(await fetch(`${API_BASE}/api/posts/${id}/like`, {
        method: 'POST', headers: await auth(),
      }));
    },

    /** Edit your own post's words. */
    async updatePost(id, body) {
      return json(await fetch(`${API_BASE}/api/posts/${id}`, {
        method: 'PATCH',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }));
    },

    /** Delete your own post (admins can delete any). */
    async deletePost(id) {
      const res = await fetch(`${API_BASE}/api/posts/${id}`, {
        method: 'DELETE', headers: await auth(),
      });
      if (!res.ok && res.status !== 204) throw new Error(`delete failed (${res.status})`);
    },

    async listComments(postId) {
      return json(await fetch(`${API_BASE}/api/posts/${postId}/comments`, { headers: await auth() }));
    },

    async addComment(postId, body) {
      return json(await fetch(`${API_BASE}/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ body }),
      }));
    },

    async deleteComment(id) {
      const res = await fetch(`${API_BASE}/api/comments/${id}`, {
        method: 'DELETE', headers: await auth(),
      });
      if (!res.ok && res.status !== 204) throw new Error(`delete failed (${res.status})`);
    },

    /** Bookmark toggle. Returns { saved }. */
    async savePost(id) {
      return json(await fetch(`${API_BASE}/api/posts/${id}/save`, {
        method: 'POST', headers: await auth(),
      }));
    },

    /** Your bookmarks, newest first. */
    async savedPosts() {
      return json(await fetch(`${API_BASE}/api/me/saved`, { headers: await auth() }));
    },

    /** Report a member to the FFG team — lands in the admin activity views. */
    async reportMember(id, reason) {
      return json(await fetch(`${API_BASE}/api/members/${id}/report`, {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }));
    },

    /** Who follows them / who they follow — the IG-style lists. */
    async followers(id) {
      return json(await fetch(`${API_BASE}/api/members/${id}/followers`, { headers: await auth() }));
    },
    async following(id) {
      return json(await fetch(`${API_BASE}/api/members/${id}/following`, { headers: await auth() }));
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
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;         // images (full-res photos)
export const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;        // video, chunked upload
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
    return `That image is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is 25MB.`;
  }
  return null;
}

/** Photos and video clips both welcome — different caps for each. */
export function validateMedia(file) {
  if (!file) return 'No file selected.';
  if (isVideoFile(file)) {
    if (file.size > MAX_VIDEO_BYTES) {
      return `That video is ${(file.size / 1024 / 1024).toFixed(0)}MB. The limit is 1GB.`;
    }
    return null;
  }
  return validateImage(file);
}
