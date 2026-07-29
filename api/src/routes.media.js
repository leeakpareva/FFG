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

const MAX_BYTES = 8 * 1024 * 1024; // 8MB

// mime -> extension. This map IS the allowlist: anything absent is rejected.
const ALLOWED = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

const KINDS = new Set(['avatar', 'post', 'event', 'article', 'other']);

// Memory storage: files are small, capped, and must be sniffed before they
// are allowed anywhere near disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
});

export const mediaRouter = Router();

mediaRouter.post('/', requireMember, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });

  const kind = KINDS.has(req.body.kind) ? req.body.kind : 'other';

  // Trust the bytes, not the header.
  const sniffed = await fileTypeFromBuffer(req.file.buffer);
  const ext = sniffed && ALLOWED[sniffed.mime];
  if (!ext) {
    return res.status(415).json({
      error: 'unsupported file type',
      detail: 'JPEG, PNG, WebP or GIF only',
    });
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
    return res.status(413).json({ error: 'file too large', detail: 'Maximum 8MB' });
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
    'SELECT mime_type FROM media WHERE storage_key = $1 AND uploaded',
    [key]
  );
  if (!rows[0]) return res.status(404).end();
  if (!(await storage.exists(key))) return res.status(404).end();

  res.set('Content-Type', rows[0].mime_type);
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  // Uploaded content is never executed in the page's origin context.
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'");
  createReadStream(storage.absolutePath(key)).pipe(res);
});
