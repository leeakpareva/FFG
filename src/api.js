/**
 * API client.
 *
 * Same-origin: nginx proxies /api and /media to the ffg-api container, so
 * there is no CORS and no base URL to configure per environment.
 *
 * Every call carries the Clerk session token. The server verifies it — the
 * UI hiding a control is convenience, never the access control.
 */

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
    /** Current member, including whether they may publish to the Library. */
    async me() {
      return json(await fetch('/api/me', { headers: await auth() }));
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
      return json(await fetch('/api/media', {
        method: 'POST',
        headers: await auth(),   // no Content-Type: the browser sets the boundary
        body: form,
      }));
    },

    async listArticles() {
      return json(await fetch('/api/articles', { headers: await auth() }));
    },

    /** Admin only — the server rejects non-admins with 403. */
    async publishArticle(article) {
      return json(await fetch('/api/articles', {
        method: 'POST',
        headers: { ...(await auth()), 'Content-Type': 'application/json' },
        body: JSON.stringify(article),
      }));
    },
  };
}

/** Client-side guard rails, mirrored server-side. */
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
export const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp,image/gif';

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
