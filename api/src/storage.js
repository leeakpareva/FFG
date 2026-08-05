/**
 * Storage driver.
 *
 * Two drivers behind one interface — put / remove / exists / createStream:
 *
 *   local (default)  files on the Docker volume at MEDIA_ROOT
 *   r2               Cloudflare R2 via the S3 API, STORAGE_DRIVER=r2
 *
 * The media table stores only a `storage_key`, so the driver is an
 * environment decision, never a schema one. R2 keys are namespaced under
 * R2_PREFIX because the bucket (navada-assets) is shared with other NAVADA
 * workloads.
 *
 * R2 env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY,
 *         R2_BUCKET, R2_PREFIX (default "ffg/").
 */
import { createWriteStream, createReadStream } from 'node:fs';
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

/* ---------------------------------------------------------------- local */

function resolveSafe(key) {
  const full = path.resolve(ROOT, key);
  // Belt and braces: even though keys are generated, never let one escape ROOT.
  if (full !== ROOT && !full.startsWith(ROOT + path.sep)) {
    throw new Error('invalid storage key');
  }
  return full;
}

const localDriver = {
  async put(key, buffer) {
    const full = resolveSafe(key);
    await mkdir(path.dirname(full), { recursive: true });
    await pipeline(Readable.from(buffer), createWriteStream(full, { mode: 0o640 }));
    return key;
  },
  async remove(key) {
    try { await unlink(resolveSafe(key)); } catch { /* already gone */ }
  },
  async exists(key) {
    try { await stat(resolveSafe(key)); return true; } catch { return false; }
  },
  async createStream(key, range) {
    return createReadStream(resolveSafe(key), range || undefined);
  },
};

/* ------------------------------------------------------------------- r2 */

function r2Driver() {
  // Lazy import keeps the SDK out of memory when the driver is local.
  let clientPromise = null;
  const bucket = process.env.R2_BUCKET || 'navada-assets';
  const prefix = process.env.R2_PREFIX ?? 'ffg/';
  const objectKey = key => prefix + key;

  const getClient = () => {
    clientPromise ||= import('@aws-sdk/client-s3').then(({ S3Client, ...cmds }) => ({
      client: new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
      }),
      cmds,
    }));
    return clientPromise;
  };

  return {
    async put(key, buffer) {
      const { client, cmds } = await getClient();
      await client.send(new cmds.PutObjectCommand({ Bucket: bucket, Key: objectKey(key), Body: buffer }));
      return key;
    },
    async remove(key) {
      const { client, cmds } = await getClient();
      try {
        await client.send(new cmds.DeleteObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
      } catch { /* already gone */ }
    },
    async exists(key) {
      const { client, cmds } = await getClient();
      try {
        await client.send(new cmds.HeadObjectCommand({ Bucket: bucket, Key: objectKey(key) }));
        return true;
      } catch { return false; }
    },
    async createStream(key, range) {
      const { client, cmds } = await getClient();
      const res = await client.send(new cmds.GetObjectCommand({
        Bucket: bucket,
        Key: objectKey(key),
        Range: range ? `bytes=${range.start}-${range.end}` : undefined,
      }));
      return res.Body; // a Readable in Node
    },
  };
}

const driver = process.env.STORAGE_DRIVER === 'r2' ? r2Driver() : localDriver;

export const put = (key, buffer) => driver.put(key, buffer);
export const remove = key => driver.remove(key);
export const exists = key => driver.exists(key);
export const createStream = (key, range) => driver.createStream(key, range);
