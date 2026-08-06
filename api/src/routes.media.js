/**
 * Member uploads.
 *
 * The browser posts the file to this API; it never holds a storage
 * credential and never chooses its own path. Every upload is validated on
 * the server by sniffing the actual file signature rather than trusting the
 * declared Content-Type, because a client can claim anything.
 */
import express, { Router } from 'express';
import multer from 'multer';
import crypto from 'node:crypto';
import path from 'node:path';
import { mkdir, appendFile, unlink, stat } from 'node:fs/promises';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
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

/* ------------------------------------------------- chunked video upload */

/**
 * Big videos, the same way replays travel: Cloudflare caps one request at
 * ~100MB, so the phone sends sequential 32MB parts, the API assembles them
 * on the media volume, sniffs the real bytes, and stores through the R2
 * driver. Cap: 1GB per feed video.
 */
const MAX_POST_VIDEO_BYTES = 1024 * 1024 * 1024;
const VIDEO_TMP = path.join(process.env.MEDIA_ROOT || '/data/media', '.uploads');
const memberUploads = new Map(); // uploadId -> { memberId, received, bytes, touched }

/* Abandoned uploads die after an hour so the volume never silts up. */
setInterval(() => {
  const cutoff = Date.now() - 60 * 60 * 1000;
  for (const [id, u] of memberUploads) {
    if (u.touched < cutoff) {
      memberUploads.delete(id);
      unlink(path.join(VIDEO_TMP, id)).catch(() => {});
    }
  }
}, 10 * 60 * 1000).unref?.();

mediaRouter.post('/video/begin', requireMember, async (req, res) => {
  await mkdir(VIDEO_TMP, { recursive: true });
  const uploadId = crypto.randomUUID();
  memberUploads.set(uploadId, { memberId: req.member.id, received: 0, bytes: 0, touched: Date.now() });
  res.status(201).json({ upload_id: uploadId, chunk_bytes: 32 * 1024 * 1024, max_bytes: MAX_POST_VIDEO_BYTES });
});

mediaRouter.put(
  '/video/part/:uploadId/:index',
  requireMember,
  express.raw({ type: () => true, limit: '40mb' }),
  async (req, res) => {
    const u = memberUploads.get(req.params.uploadId);
    if (!u || u.memberId !== req.member.id) return res.status(404).json({ error: 'no such upload' });
    const index = Number(req.params.index);
    if (index !== u.received) {
      return res.status(409).json({ error: `expected part ${u.received}, got ${index}` });
    }
    if (!req.body?.length) return res.status(400).json({ error: 'empty part' });
    if (u.bytes + req.body.length > MAX_POST_VIDEO_BYTES) {
      memberUploads.delete(req.params.uploadId);
      await unlink(path.join(VIDEO_TMP, req.params.uploadId)).catch(() => {});
      return res.status(413).json({ error: 'video too large (1GB cap)' });
    }
    await appendFile(path.join(VIDEO_TMP, req.params.uploadId), req.body);
    u.received += 1;
    u.bytes += req.body.length;
    u.touched = Date.now();
    res.json({ received: u.received, bytes: u.bytes });
  }
);

mediaRouter.post('/video/finish', requireMember, async (req, res) => {
  const uploadId = req.body?.upload_id;
  const u = memberUploads.get(uploadId);
  if (!u || u.memberId !== req.member.id) return res.status(404).json({ error: 'no such upload' });
  memberUploads.delete(uploadId);
  const tmpFile = path.join(VIDEO_TMP, uploadId);

  try {
    const sniffed = await fileTypeFromFile(tmpFile);
    const ext = sniffed && ALLOWED_VIDEO[sniffed.mime];
    if (!ext) {
      return res.status(415).json({ error: 'unsupported video type', detail: 'MP4, WebM or MOV.' });
    }
    const { size } = await stat(tmpFile);

    const key = storage.makeKey(req.member.id, 'post', ext);
    const { rows } = await q(
      `INSERT INTO media (owner_id, storage_key, kind, mime_type, byte_size, uploaded)
       VALUES ($1,$2,'post',$3,$4,false) RETURNING id`,
      [req.member.id, key, sniffed.mime, size]
    );
    try {
      await storage.putFile(key, tmpFile);
    } catch (e) {
      await q('DELETE FROM media WHERE id = $1', [rows[0].id]);
      console.error('[media video] store failed:', e.message);
      return res.status(500).json({ error: 'could not store video' });
    }
    await q('UPDATE media SET uploaded = true WHERE id = $1', [rows[0].id]);
    track(req.member.id, 'media_upload', { media: rows[0].id, bytes: size });

    res.status(201).json({ id: rows[0].id, url: `/media/${key}`, mime: sniffed.mime, bytes: size });
  } finally {
    unlink(tmpFile).catch(() => {});
  }
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
    return (await storage.createStream(key, { start, end })).pipe(res);
  }

  res.set('Content-Length', String(size));
  (await storage.createStream(key)).pipe(res);
});
