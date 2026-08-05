/**
 * Member uploads.
 *
 * The browser posts the file to this API; it never holds a storage
 * credential and never chooses its own path. Every upload is validated on
 * the server by sniffing the actual file signature rather than trusting the
 * declared Content-Type, because a client can claim anything.
 */
import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { createReadStream } from 'node:fs';
import { q } from './db.js';
import { requireMember } from './auth.js';
import * as storage from './storage.js';
import { track } from './track.js';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;  // 25MB — full-resolution phone photos
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB — full clips

// mime -> extension. These maps ARE the allowlist: anything absent is
// rejected. Videos are capped separately because they are honestly bigger.
const ALLOWED_IMAGE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const ALLOWED_VIDEO = {
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov', // iPhone camera; note HEVC .mov may not play in every browser
};

const KINDS = new Set(['avatar', 'post', 'event', 'article', 'other']);

// Memory storage: files are capped and must be sniffed before they are
// allowed anywhere near disk. 60MB in memory per request is fine at this
// membership's scale.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_VIDEO_BYTES, files: 1 },
});

export const mediaRouter = Router();

mediaRouter.post('/', requireMember, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const kind = KINDS.has(req.body.kind) ? req.body.kind : 'other';

  // Trust the bytes, not the header.
  const sniffed = await fileTypeFromBuffer(req.file.buffer);
  const isImage = sniffed && ALLOWED_IMAGE[sniffed.mime];
  const isVideo = sniffed && ALLOWED_VIDEO[sniffed.mime];
  const ext = isImage || isVideo;
  if (!ext) {
    return res.status(415).json({
      error: 'unsupported file type',
      detail: 'Images: JPEG, PNG, WebP, GIF. Video: MP4, WebM, MOV.',
    });
  }
  if (isImage && req.file.size > MAX_IMAGE_BYTES) {
    return res.status(413).json({ error: 'too large', detail: 'Images are capped at 25MB.' });
  }
  // Avatars are images, full stop.
  if (isVideo && kind === 'avatar') {
    return res.status(415).json({ error: 'unsupported file type', detail: 'Profile photos are images.' });
  }

  const key = storage.makeKey(req.member.id, kind, ext);

  const { rows } = await q(
    `INSERT INTO media (owner_id, storage_key, kind, mime_type, byte_size, alt_text, uploaded)
     VALUES ($1,$2,$3,$4,$5,$6,false)
     RETURNING id, storage_key`,
    [req.member.id, key, kind, sniffed.mime, req.file.size, req.body.alt_text || null]
  );
  const media = rows[0];

  try {
    await storage.put(key, req.file.buffer);
  } catch (e) {
    // Never leave a row claiming a file that is not on disk.
    await q('DELETE FROM media WHERE id = $1', [media.id]);
    console.error('[media] write failed', e.message);
    return res.status(500).json({ error: 'could not store file' });
  }

  await q('UPDATE media SET uploaded = true WHERE id = $1', [media.id]);
  track(req.member.id, 'media_upload', { media: media.id, bytes: req.file.size });

  res.status(201).json({
    id: media.id,
    url: `/media/${key}`,
    mime: sniffed.mime,
    bytes: req.file.size,
  });
});

/** Multer rejects oversize files with its own error code — translate it. */
mediaRouter.use((err, _req, res, next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'file too large', detail: 'Images up to 25MB, video up to 100MB.' });
  }
  if (err) {
    console.error('[media]', err.message);
    return res.status(400).json({ error: 'upload failed' });
  }
  next();
});

/**
 * Serving. Kept on the API so an access check can be added later without
 * moving URLs; nginx caches the responses.
 */
export const mediaFileRouter = Router();

mediaFileRouter.get(/^\/(.+)$/, async (req, res) => {
  const key = req.params[0];
  const { rows } = await q(
    'SELECT mime_type, byte_size FROM media WHERE storage_key = $1 AND uploaded',
    [key]
  );
  if (!rows[0]) return res.status(404).end();
  if (!(await storage.exists(key))) return res.status(404).end();

  res.set('Content-Type', rows[0].mime_type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  // Uploaded content is never executed in the page's origin context.
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; media-src 'self'");

  /* Range requests: video players seek, and a player that cannot seek
     feels broken. One contiguous range is all any of them ask for. */
  const size = Number(rows[0].byte_size);
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  res.set('Accept-Ranges', 'bytes');
  if (range && size > 0) {
    const start = range[1] ? parseInt(range[1], 10) : 0;
    const end = range[2] ? Math.min(parseInt(range[2], 10), size - 1) : size - 1;
    if (start >= size || start > end) {
      return res.status(416).set('Content-Range', `bytes */${size}`).end();
    }
    res.status(206);
    res.set('Content-Range', `bytes ${start}-${end}/${size}`);
    res.set('Content-Length', String(end - start + 1));
    return createReadStream(storage.absolutePath(key), { start, end }).pipe(res);
  }

  res.set('Content-Length', String(size));
  createReadStream(storage.absolutePath(key)).pipe(res);
});
