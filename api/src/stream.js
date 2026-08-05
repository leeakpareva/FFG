/**
 * Cloudflare Stream.
 *
 * Two jobs:
 *   1. Give the admin panel a direct-upload URL, so video bytes go from the
 *      admin's browser straight to Cloudflare — never through this API, whose
 *      box has neither the disk nor the bandwidth to want them.
 *   2. Mint short-lived signed playback tokens for members. Every video is
 *      created with requireSignedURLs, so possession of a uid alone plays
 *      nothing outside the app.
 *
 * Config: CF_ACCOUNT_ID + CF_STREAM_TOKEN (API token with Stream:Edit).
 * Absent config degrades to "video service not configured" — the rest of the
 * admin panel does not care.
 */
const ACCOUNT = process.env.CF_ACCOUNT_ID;
const TOKEN = process.env.CF_STREAM_TOKEN;

export const streamReady = !!(ACCOUNT && TOKEN);

const BASE = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/stream`;

async function cf(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.success === false) {
    const detail = body.errors?.[0]?.message || `HTTP ${res.status}`;
    throw new Error(`Stream API: ${detail}`);
  }
  return body.result;
}

/**
 * One-time upload URL, valid for a single video up to `maxDurationSeconds`.
 * The browser PUTs the file at it; we keep the uid.
 */
export async function directUploadUrl({ maxDurationSeconds = 4 * 3600, name } = {}) {
  const result = await cf('/direct_upload', {
    method: 'POST',
    body: JSON.stringify({
      maxDurationSeconds,
      requireSignedURLs: true,
      meta: name ? { name } : undefined,
    }),
  });
  return { uploadURL: result.uploadURL, uid: result.uid };
}

/** Signed playback token, two hours — long enough for any replay. */
export async function playbackToken(uid) {
  const result = await cf(`/${uid}/token`, {
    method: 'POST',
    body: JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 2 * 3600 }),
  });
  return result.token;
}

/** Processing state + duration, for the admin panel's video list. */
export async function videoStatus(uid) {
  const v = await cf(`/${uid}`);
  return {
    ready: v.readyToStream === true,
    state: v.status?.state || 'unknown',
    duration: v.duration ?? null,
    thumbnail: v.thumbnail || null,
  };
}

export async function deleteVideo(uid) {
  await cf(`/${uid}`, { method: 'DELETE' });
}
