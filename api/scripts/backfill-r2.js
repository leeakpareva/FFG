/**
 * One-shot: copy every uploaded file from the local volume into R2.
 *
 * Run inside the ffg-api container AFTER the R2_* env vars are present but
 * regardless of which driver is active — it reads the volume directly and
 * writes to R2, so it is safe to run before or after the driver flip, and
 * safe to run twice (puts are idempotent overwrites of identical bytes).
 *
 *   docker exec ffg-api node scripts/backfill-r2.js
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

const ROOT = process.env.MEDIA_ROOT || '/data/media';
const bucket = process.env.R2_BUCKET || 'navada-assets';
const prefix = process.env.R2_PREFIX ?? 'ffg/';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const { rows } = await pool.query(
  'SELECT storage_key, mime_type, byte_size FROM media WHERE uploaded ORDER BY created_at'
);
console.log(`${rows.length} file(s) to consider`);

let copied = 0, skipped = 0, failed = 0;
for (const row of rows) {
  const dest = prefix + row.storage_key;
  try {
    try {
      await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: dest }));
      skipped++;
      continue; // already there
    } catch { /* not yet — copy it */ }
    const body = await readFile(path.resolve(ROOT, row.storage_key));
    await s3.send(new PutObjectCommand({
      Bucket: bucket, Key: dest, Body: body, ContentType: row.mime_type,
    }));
    copied++;
    console.log(`  copied ${row.storage_key} (${row.byte_size} bytes)`);
  } catch (e) {
    failed++;
    console.error(`  FAILED ${row.storage_key}: ${e.message}`);
  }
}
console.log(`done: ${copied} copied, ${skipped} already present, ${failed} failed`);
await pool.end();
process.exit(failed ? 1 : 0);
