/**
 * Storage driver.
 *
 * Files live on a Docker volume and are served back through this API. The
 * media table stores only a `storage_key`, so moving to R2 later means
 * implementing put/remove against S3 and backfilling the existing keys —
 * no schema change and no change to the routes that call this.
 */
import { createWriteStream } from 'node:fs';
import { mkdir, unlink, stat } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT = process.env.MEDIA_ROOT || '/data/media';

/** Keys are generated, never taken from the client — no path traversal, no collisions. */
export function makeKey(ownerId, kind, ext) {
  const now = new Date();
  const safeOwner = String(ownerId).replace(/[^A-Za-z0-9_-]/g, '');
  return `${kind}/${safeOwner}/${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}.${ext}`;
}

function resolveSafe(key) {
  const full = path.resolve(ROOT, key);
  // Belt and braces: even though keys are generated, never let one escape ROOT.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error('invalid storage key');
  }
  return full;
}

export async function put(key, buffer) {
  const full = resolveSafe(key);
  await mkdir(path.dirname(full), { recursive: true });
  await pipeline(Readable.from(buffer), createWriteStream(full, { mode: 0o640 }));
  return key;
}

export async function remove(key) {
  try { await unlink(resolveSafe(key)); } catch { /* already gone */ }
}

export async function exists(key) {
  try { await stat(resolveSafe(key)); return true; } catch { return false; }
}

export function absolutePath(key) {
  return resolveSafe(key);
}
