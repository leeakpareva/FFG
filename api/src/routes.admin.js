/**
 * The admin surface. Everything here sits behind requireSuperAdmin — the
 * username/password login in adminAuth.js — and none of it is reachable
 * with a Clerk token, however admin the member behind it.
 *
 * Shape of the file: stats, members, content (articles / events / replays /
 * workshops), media, payments. Each section is small and boring on purpose;
 * the interesting rules (signed video, webhook, ledger) live in their own
 * modules.
 */
import express, { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer, fileTypeFromFile } from 'file-type';
import crypto from 'node:crypto';
import { mkdir, appendFile, unlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { createClerkClient } from '@clerk/backend';
import { q, pool } from './db.js';
import bcrypt from 'bcryptjs';
import sharp from 'sharp';
import { requireAdmin, requireSuperAdmin, hasScope } from './adminAuth.js';
import * as storage from './storage.js';
import { videoStatus, deleteVideo, streamReady } from './stream.js';
import {
  sendMail, ffgEmail, emailButton, escapeHtml, APP_BASE,
  APP_STORE_URL, PLAY_STORE_URL,
} from './mailer.js';
import { createPayment, stripeReady, stripeTestMode, payId } from './stripe.js';
import { reindexAll, embedReady } from './embed.js';

export const adminRouter = Router();
adminRouter.use(requireAdmin);

/**
 * Area access. The superadmin passes everything; a team account needs the
 * matching scope. Path prefixes not listed here stay superadmin-only, so a
 * new route is private until it is deliberately opened up.
 *
 *   null scope = any signed-in admin (uploads: files are keyed server-side
 *   and harmless to hold; every scoped area needs them).
 */
const SCOPE_RULES = [
  ['/site-content', 'website'],
  ['/marketing', 'marketing'],
  ['/applications', 'applications'],
  ['/reviewers', 'applications'],
  ['/media', null],
];
adminRouter.use((req, res, next) => {
  const rule = SCOPE_RULES.find(([prefix]) => req.path === prefix || req.path.startsWith(prefix + '/'));
  if (rule) {
    if (rule[1] === null || hasScope(req, rule[1])) return next();
    return res.status(403).json({ error: 'not allowed' });
  }
  if (req.admin.role !== 'superadmin') return res.status(403).json({ error: 'not allowed' });
  next();
});

const PILLARS = ['Capital', 'Community', 'Connect'];
const clerk = process.env.CLERK_SECRET_KEY
  ? createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
  : null;

/** "Your first five hires" -> "your-first-five-hires-3f2a" */
const contentId = (title) =>
  String(title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  + '-' + crypto.randomBytes(2).toString('hex');

/**
 * The house account — the member everything official is published and sent
 * as. Lee's call: FFG Content (FC), so articles and admin messages arrive
 * from the brand, not from whoever happened to be in the admin panel.
 * Configurable via ADMIN_HOUSE_MEMBER; falls back to the first admin member.
 */
async function houseMember() {
  const preferred = process.env.ADMIN_HOUSE_MEMBER || 'FC';
  const byId = await q('SELECT id FROM members WHERE id = $1', [preferred]);
  if (byId.rows[0]) return byId.rows[0].id;
  const fallback = await q('SELECT id FROM members WHERE is_admin ORDER BY created_at LIMIT 1');
  return fallback.rows[0]?.id || null;
}

/* ================================================================== stats */

adminRouter.get('/stats/overview', async (_req, res) => {
  const [members, dau, wau, storageUse, revenue, pending, content] = await Promise.all([
    q(`SELECT count(*)::int AS n, count(*) FILTER (WHERE clerk_id IS NOT NULL)::int AS signed_in FROM members`),
    q(`SELECT count(DISTINCT member_id)::int AS n FROM usage_events WHERE type='active' AND created_at > now() - interval '1 day'`),
    q(`SELECT count(DISTINCT member_id)::int AS n FROM usage_events WHERE type='active' AND created_at > now() - interval '7 days'`),
    q(`SELECT coalesce(sum(byte_size),0)::bigint AS bytes, count(*)::int AS files FROM media WHERE uploaded`),
    q(`SELECT coalesce(sum(amount_pence),0)::bigint AS pence FROM payments WHERE status='paid'`),
    q(`SELECT coalesce(sum(amount_pence),0)::bigint AS pence, count(*)::int AS n FROM payments WHERE status='pending'`),
    q(`SELECT
         (SELECT count(*)::int FROM articles WHERE NOT is_draft) AS articles,
         (SELECT count(*)::int FROM events) AS events,
         (SELECT count(*)::int FROM replays WHERE published) AS replays,
         (SELECT count(*)::int FROM workshops WHERE published) AS workshops`),
  ]);
  res.json({
    members: members.rows[0],
    dau: dau.rows[0].n,
    wau: wau.rows[0].n,
    storage: storageUse.rows[0],
    revenue_pence: Number(revenue.rows[0].pence),
    pending: { pence: Number(pending.rows[0].pence), count: pending.rows[0].n },
    content: content.rows[0],
    integrations: { stream: streamReady, stripe: stripeReady, stripe_test_mode: stripeTestMode },
  });
});

adminRouter.get('/stats/activity', async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 30));
  const [actives, byType] = await Promise.all([
    q(`SELECT date_trunc('day', created_at)::date AS day, count(DISTINCT member_id)::int AS members
         FROM usage_events WHERE type='active' AND created_at > now() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1`, [days]),
    q(`SELECT date_trunc('day', created_at)::date AS day, type, count(*)::int AS n
         FROM usage_events WHERE type <> 'active' AND created_at > now() - ($1 || ' days')::interval
        GROUP BY 1, 2 ORDER BY 1`, [days]),
  ]);
  res.json({ days, actives: actives.rows, by_type: byType.rows });
});

/** Minutes actually spent in the app, per day — one ping row ≈ one minute. */
adminRouter.get('/stats/timespent', async (req, res) => {
  const days = Math.min(90, Math.max(7, parseInt(req.query.days, 10) || 14));
  const [daily, top] = await Promise.all([
    q(`SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS minutes
         FROM usage_events WHERE type='ping' AND created_at > now() - ($1 || ' days')::interval
        GROUP BY 1 ORDER BY 1`, [days]),
    q(`SELECT u.member_id, m.name, count(*)::int AS minutes
         FROM usage_events u JOIN members m ON m.id = u.member_id
        WHERE u.type='ping' AND u.created_at > now() - ($1 || ' days')::interval
        GROUP BY 1, 2 ORDER BY minutes DESC LIMIT 8`, [days]),
  ]);
  res.json({ days, daily: daily.rows, top: top.rows });
});

/** What content is actually landing: reads per article, social volume. */
adminRouter.get('/stats/engagement', async (_req, res) => {
  const [articles, social] = await Promise.all([
    q(`SELECT a.id, a.title,
              (SELECT count(*)::int FROM usage_events u
                WHERE u.type='article_read' AND u.meta->>'article' = a.id) AS reads
         FROM articles a ORDER BY reads DESC LIMIT 8`),
    q(`SELECT
         (SELECT count(*)::int FROM posts)      AS posts,
         (SELECT count(*)::int FROM post_likes) AS likes,
         (SELECT count(*)::int FROM messages)   AS messages,
         (SELECT count(*)::int FROM follows)    AS follows,
         (SELECT count(*)::int FROM event_attendees) AS rsvps`),
  ]);
  res.json({ articles: articles.rows, social: social.rows[0] });
});

adminRouter.get('/stats/rooms', async (_req, res) => {
  const { rows } = await q(`
    SELECT r.id, r.title, count(u.id)::int AS joins
      FROM rooms r
      LEFT JOIN usage_events u
        ON u.type = 'room_join' AND u.meta->>'room' = r.id
       AND u.created_at > now() - interval '30 days'
     GROUP BY r.id, r.title ORDER BY joins DESC`);
  res.json({ rooms: rows });
});

adminRouter.get('/stats/revenue', async (_req, res) => {
  const { rows } = await q(`
    SELECT date_trunc('month', coalesce(paid_at, created_at))::date AS month,
           sum(amount_pence) FILTER (WHERE status='paid')::bigint    AS paid_pence,
           sum(amount_pence) FILTER (WHERE status='pending')::bigint AS pending_pence
      FROM payments
     WHERE created_at > now() - interval '12 months'
     GROUP BY 1 ORDER BY 1`);
  res.json({ months: rows.map(r => ({ ...r, paid_pence: Number(r.paid_pence || 0), pending_pence: Number(r.pending_pence || 0) })) });
});

/** Backfill embeddings for anything missing one. Safe to run repeatedly. */
adminRouter.post('/reindex', async (_req, res) => {
  if (!embedReady) return res.status(503).json({ error: 'no OPENAI_API_KEY configured' });
  res.json(await reindexAll());
});

/* ================================================================ members */

adminRouter.get('/members', async (_req, res) => {
  const { rows } = await q(`
    SELECT m.id, m.name, m.handle, m.email, m.role, m.pillar, m.bio,
           m.verified, m.is_admin, m.is_org, m.created_at,
           (m.clerk_id IS NOT NULL) AS has_signed_in,
           last.seen AS last_seen,
           coalesce(acts.n, 0)::int AS actions_30d,
           av.storage_key AS avatar_key
      FROM members m
      LEFT JOIN LATERAL (
        SELECT max(created_at) AS seen FROM usage_events WHERE member_id = m.id
      ) last ON true
      LEFT JOIN LATERAL (
        SELECT count(*) AS n FROM usage_events
         WHERE member_id = m.id AND created_at > now() - interval '30 days'
      ) acts ON true
      LEFT JOIN media av ON av.id = m.avatar_media_id
     ORDER BY last.seen DESC NULLS LAST, m.created_at`);
  res.json({
    members: rows.map(r => ({ ...r, avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null })),
  });
});

const MEMBER_FIELDS = { name: 'text', handle: 'text', role: 'text', pillar: 'pillar', bio: 'text', verified: 'bool', is_admin: 'bool' };

adminRouter.patch('/members/:id', async (req, res) => {
  const sets = [];
  const vals = [];
  for (const [field, kind] of Object.entries(MEMBER_FIELDS)) {
    if (!(field in (req.body || {}))) continue;
    let v = req.body[field];
    if (kind === 'pillar' && !PILLARS.includes(v)) {
      return res.status(400).json({ error: 'pillar must be Capital, Community or Connect' });
    }
    if (kind === 'bool') v = !!v;
    vals.push(v);
    sets.push(`${field} = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.id);
  const { rows } = await q(
    `UPDATE members SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length} RETURNING id`,
    vals
  );
  if (!rows[0]) return res.status(404).json({ error: 'no such member' });
  res.json({ ok: true });
});

/**
 * Pre-create a member row and open the Clerk allowlist door for their email.
 * resolveMember() in auth.js claims the row by email on first sign-in.
 * Throws {status, error} on conflict.
 */
async function inviteMember({ name, email, role = 'Member', pillar = 'Community' }) {
  const initials = name.trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'ME';
  const handle = name.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '').slice(0, 24) || 'member';

  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = attempt ? String(attempt + 1) : '';
    try {
      const { rows } = await q(
        `INSERT INTO members (id, name, handle, role, pillar, email, is_admin)
         VALUES ($1,$2,$3,$4,$5,$6,false) RETURNING id, name, handle, email`,
        [initials + suffix, name.trim(), handle + suffix, role, pillar, email.toLowerCase()]
      );
      /* Sign-up is allowlist-only in Clerk, so an invite must open the door
         there too or the new member can never register. */
      if (clerk) {
        try {
          await clerk.allowlistIdentifiers.createAllowlistIdentifier({
            identifier: email.toLowerCase(), notify: false,
          });
        } catch (e) { console.error('[admin] clerk allowlist add failed:', e.message); }
      }
      return rows[0];
    } catch (e) {
      if (e.code !== '23505') throw e;
      if (/email/.test(e.constraint || '')) {
        throw { status: 409, error: 'a member with that email already exists' };
      }
    }
  }
  throw { status: 500, error: 'could not find a free id' };
}

/** Invite: pre-create the row; no invite email is sent, Lee tells them himself. */
adminRouter.post('/members', async (req, res) => {
  const { name, email, role = 'Member', pillar = 'Community' } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  if (!PILLARS.includes(pillar)) return res.status(400).json({ error: 'bad pillar' });
  try {
    res.status(201).json(await inviteMember({ name, email, role, pillar }));
  } catch (e) {
    if (e.status) return res.status(e.status).json({ error: e.error });
    throw e;
  }
});

/**
 * The drill-down: one member, properly understood. Time in the app per day,
 * what they have been doing, what they have paid, what they attend.
 */
adminRouter.get('/members/:id/insight', async (req, res) => {
  const member = await q(`
    SELECT m.id, m.name, m.handle, m.email, m.role, m.pillar, m.bio, m.verified,
           m.is_admin, m.created_at, (m.clerk_id IS NOT NULL) AS has_signed_in,
           av.storage_key AS avatar_key,
           (SELECT count(*)::int FROM posts p WHERE p.member_id = m.id)     AS posts,
           (SELECT count(*)::int FROM follows f WHERE f.followee_id = m.id) AS followers,
           (SELECT count(*)::int FROM follows f WHERE f.follower_id = m.id) AS following,
           (SELECT count(*)::int FROM messages ms WHERE ms.sender_id = m.id) AS messages_sent,
           (SELECT max(created_at) FROM usage_events u WHERE u.member_id = m.id) AS last_seen
      FROM members m
      LEFT JOIN media av ON av.id = m.avatar_media_id
     WHERE m.id = $1`, [req.params.id]);
  if (!member.rows[0]) return res.status(404).json({ error: 'no such member' });

  const [minutes, byType, recent, payments, events] = await Promise.all([
    q(`SELECT date_trunc('day', created_at)::date AS day, count(*)::int AS minutes
         FROM usage_events WHERE member_id = $1 AND type = 'ping'
          AND created_at > now() - interval '14 days'
        GROUP BY 1 ORDER BY 1`, [req.params.id]),
    q(`SELECT type, count(*)::int AS n
         FROM usage_events WHERE member_id = $1 AND type NOT IN ('ping')
          AND created_at > now() - interval '30 days'
        GROUP BY 1 ORDER BY n DESC`, [req.params.id]),
    q(`SELECT type, meta, created_at
         FROM usage_events WHERE member_id = $1 AND type NOT IN ('ping', 'active')
        ORDER BY created_at DESC LIMIT 40`, [req.params.id]),
    q(`SELECT id, description, amount_pence, status, method, created_at, paid_at
         FROM payments WHERE member_id = $1 ORDER BY created_at DESC LIMIT 25`, [req.params.id]),
    q(`SELECT e.id, e.name, e.price_pence, a.rsvp_at
         FROM event_attendees a JOIN events e ON e.id = a.event_id
        WHERE a.member_id = $1 ORDER BY a.rsvp_at DESC`, [req.params.id]),
  ]);

  const r = member.rows[0];
  res.json({
    member: { ...r, avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null },
    minutes_daily: minutes.rows,
    minutes_total_14d: minutes.rows.reduce((n, x) => n + x.minutes, 0),
    activity_by_type: byType.rows,
    recent_activity: recent.rows,
    payments: payments.rows,
    events: events.rows,
  });
});

/**
 * A message from the house. It is sent as the first admin member (Lee), so
 * it lands in the member's ordinary DMs from a real person — no parallel
 * "system message" plumbing for the app to special-case.
 */
adminRouter.post('/members/:id/message', async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });

  const target = await q('SELECT id FROM members WHERE id = $1', [req.params.id]);
  if (!target.rows[0]) return res.status(404).json({ error: 'no such member' });

  const from = await houseMember();
  if (!from) return res.status(409).json({ error: 'no house member to send as' });
  if (from === req.params.id) return res.status(400).json({ error: 'that is the admin member themselves' });

  const [a, b] = from < req.params.id ? [from, req.params.id] : [req.params.id, from];
  const thread = await q(`
    INSERT INTO threads (member_a, member_b) VALUES ($1, $2)
    ON CONFLICT (member_a, member_b) DO UPDATE SET member_a = threads.member_a
    RETURNING id`, [a, b]);
  await q(`INSERT INTO messages (thread_id, sender_id, body) VALUES ($1, $2, $3)`,
    [thread.rows[0].id, from, body.slice(0, 2000)]);
  res.status(201).json({ ok: true, thread: thread.rows[0].id, sent_as: from });
});

/**
 * Delete is the full exit: rows cascade, uploaded files leave the disk, and
 * the Clerk account goes too, so the person cannot sign straight back in
 * through open registration with their access restored.
 */
adminRouter.delete('/members/:id', async (req, res) => {
  const { rows } = await q('SELECT id, clerk_id, email FROM members WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'no such member' });

  const files = await q('SELECT storage_key FROM media WHERE owner_id = $1', [req.params.id]);
  await q('DELETE FROM members WHERE id = $1', [req.params.id]); // cascades

  for (const f of files.rows) {
    try { await storage.remove(f.storage_key); } catch { /* row is gone; a stray file is a sweep job */ }
  }
  if (rows[0].clerk_id && clerk) {
    try { await clerk.users.deleteUser(rows[0].clerk_id); }
    catch (e) { console.error('[admin] clerk delete failed:', e.message); }
  }
  if (rows[0].email && clerk) {
    // Close the allowlist door too, or they could just sign up again.
    try {
      const { data } = await clerk.allowlistIdentifiers.getAllowlistIdentifierList({ limit: 500 });
      const hit = data.find(a => a.identifier === rows[0].email);
      if (hit) await clerk.allowlistIdentifiers.deleteAllowlistIdentifier(hit.id);
    } catch (e) { console.error('[admin] clerk allowlist remove failed:', e.message); }
  }
  res.status(204).end();
});

/* ================================================================== media */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
const MEDIA_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};
/* Marketing takes documents and audio on top of images and video. */
const MARKETING_EXT = {
  ...MEDIA_EXT,
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/x-wav': 'wav',
};

/* A phone photo straight onto the hero is 8MB the site then ships raw
   (Next's optimizer is off on the website). Large stills are resized to a
   web ceiling and their dimensions recorded; GIFs (animation) and video
   pass through untouched. */
const IMAGE_MAX_EDGE = 2560;
/* The API container runs with a 512MB ceiling — keep sharp lean. */
sharp.cache(false);
sharp.concurrency(1);
async function normalizeImage(buffer, mime) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) return { buffer };
  try {
    const img = sharp(buffer, { failOn: 'none' }).rotate(); // honour EXIF orientation
    const meta = await img.metadata();
    if (!meta.width || !meta.height) return { buffer };
    if (meta.width <= IMAGE_MAX_EDGE && meta.height <= IMAGE_MAX_EDGE) {
      return { buffer, width: meta.width, height: meta.height };
    }
    const resized = img.resize({ width: IMAGE_MAX_EDGE, height: IMAGE_MAX_EDGE, fit: 'inside', withoutEnlargement: true });
    const out = mime === 'image/png'
      ? await resized.png().toBuffer({ resolveWithObject: true })
      : mime === 'image/webp'
        ? await resized.webp({ quality: 85 }).toBuffer({ resolveWithObject: true })
        : await resized.jpeg({ quality: 85, mozjpeg: true }).toBuffer({ resolveWithObject: true });
    return { buffer: out.data, width: out.info.width, height: out.info.height };
  } catch (e) {
    console.error('[media resize] falling back to original:', e.message);
    return { buffer };
  }
}

/** Sniff, normalise, store and record one uploaded file. Returns the media row bits. */
async function storeAdminFile(file, { kind, allow }) {
  const sniffed = await fileTypeFromBuffer(file.buffer);
  const ext = sniffed && allow[sniffed.mime];
  if (!ext) return { error: 415 };

  const owner = await houseMember();
  if (!owner) return { error: 409 };

  const { buffer, width, height } = await normalizeImage(file.buffer, sniffed.mime);
  const key = storage.makeKey(owner, kind, ext);
  const { rows } = await q(
    `INSERT INTO media (owner_id, storage_key, kind, mime_type, byte_size, width, height, uploaded)
     VALUES ($1,$2,$3,$4,$5,$6,$7,false) RETURNING id, storage_key`,
    [owner, key, kind, sniffed.mime, buffer.length, width || null, height || null]
  );
  try {
    await storage.put(key, buffer);
  } catch (e) {
    await q('DELETE FROM media WHERE id = $1', [rows[0].id]);
    console.error('[admin media] write failed', e.message);
    return { error: 500 };
  }
  await q('UPDATE media SET uploaded = true WHERE id = $1', [rows[0].id]);
  return { id: rows[0].id, key, mime: sniffed.mime, bytes: buffer.length, width, height };
}

/** Covers, thumbnails, site photos and clips. Owned by the house account. */
adminRouter.post('/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const stored = await storeAdminFile(req.file, { kind: 'article', allow: MEDIA_EXT });
  if (stored.error === 415) return res.status(415).json({ error: 'Images (JPEG, PNG, WebP, GIF) or video (MP4, WebM, MOV) only' });
  if (stored.error === 409) return res.status(409).json({ error: 'no house member to own the file' });
  if (stored.error) return res.status(500).json({ error: 'could not store file' });
  res.status(201).json({ id: stored.id, key: stored.key, url: `/media/${stored.key}` });
});

/* =============================================================== articles */

adminRouter.get('/articles', async (_req, res) => {
  const { rows } = await q(`
    SELECT a.id, a.title, a.excerpt, a.tag, a.read_time, a.is_draft, a.created_at,
           (SELECT count(*)::int FROM usage_events u WHERE u.type='article_read' AND u.meta->>'article' = a.id) AS reads
      FROM articles a ORDER BY a.created_at DESC`);
  res.json({ articles: rows });
});

adminRouter.post('/articles', async (req, res) => {
  const { title, excerpt, tag, body, read_time, media_id, is_draft } = req.body || {};
  if (!title || !Array.isArray(body) || body.length === 0) {
    return res.status(400).json({ error: 'title and a non-empty body are required' });
  }
  if (!PILLARS.includes(tag)) return res.status(400).json({ error: 'bad tag' });

  const id = contentId(title);
  const author = await houseMember(); // the byline: FFG Content
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO articles (id, title, excerpt, tag, author_id, read_time, media_id, published_at, is_draft, published_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7, CASE WHEN $8 THEN NULL ELSE now() END, $8, 'Today')`,
      [id, title, excerpt || null, tag, author, read_time || null, media_id || null, !!is_draft]
    );
    for (const [i, para] of body.entries()) {
      await client.query('INSERT INTO article_paragraphs (article_id, ord, body) VALUES ($1,$2,$3)', [id, i, para]);
    }
    await client.query('COMMIT');
    res.status(201).json({ id });
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

adminRouter.patch('/articles/:id', async (req, res) => {
  const { is_draft } = req.body || {};
  if (typeof is_draft !== 'boolean') return res.status(400).json({ error: 'is_draft required' });
  const { rows } = await q(
    `UPDATE articles SET is_draft = $2, published_at = CASE WHEN $2 THEN NULL ELSE coalesce(published_at, now()) END
      WHERE id = $1 RETURNING id`, [req.params.id, is_draft]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

adminRouter.delete('/articles/:id', async (req, res) => {
  const { rowCount } = await q('DELETE FROM articles WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/* ================================================================= events */

adminRouter.get('/events', async (_req, res) => {
  const { rows } = await q(`
    SELECT e.*, (SELECT count(*)::int FROM event_attendees a WHERE a.event_id = e.id) AS attendee_count
      FROM events e ORDER BY e.starts_at NULLS LAST, e.created_at DESC`);
  res.json({ events: rows });
});

/** Who's coming: every member who RSVP'd or bought a seat, newest first. */
adminRouter.get('/events/:id/attendees', async (req, res) => {
  const { rows } = await q(`
    SELECT m.id, m.name, m.handle, m.email, a.rsvp_at,
           EXISTS (SELECT 1 FROM payments p
                    WHERE p.event_id = a.event_id AND p.member_id = a.member_id AND p.status = 'paid') AS paid
      FROM event_attendees a JOIN members m ON m.id = a.member_id
     WHERE a.event_id = $1
     ORDER BY a.rsvp_at DESC`, [req.params.id]);
  res.json({ attendees: rows });
});

adminRouter.post('/events', async (req, res) => {
  const { name, venue, day, month, time_label, tag, spots, host_id, image_key, about, starts_at, price_pence } = req.body || {};
  if (!name || !venue || !day || !month) {
    return res.status(400).json({ error: 'name, venue, day and month are required' });
  }
  if (!PILLARS.includes(tag)) return res.status(400).json({ error: 'bad tag' });
  /* No price or 0 = free. A priced event routes members through Stripe. */
  const price = parseInt(price_pence, 10);
  const priced = Number.isInteger(price) && price > 0 ? price : null;
  const id = contentId(name);
  await q(
    `INSERT INTO events (id, name, venue, day, month, starts_at, time_label, tag, spots, host_id, image_key, about, price_pence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, name, venue, day, month, starts_at || null, time_label || null, tag,
     spots || null, host_id || null, image_key || null, about || null, priced]
  );
  res.status(201).json({ id });
});

adminRouter.delete('/events/:id', async (req, res) => {
  const { rowCount } = await q('DELETE FROM events WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/* ================================================================ replays */

adminRouter.get('/replays', async (_req, res) => {
  const { rows } = await q('SELECT * FROM replays ORDER BY created_at DESC');
  res.json({ replays: rows });
});

adminRouter.post('/replays', async (req, res) => {
  const { title, summary, tag = 'Community', duration, chapters = [], speakers = [], image_key } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!PILLARS.includes(tag)) return res.status(400).json({ error: 'bad tag' });
  const id = contentId(title);
  await q(
    `INSERT INTO replays (id, title, summary, tag, duration, chapters, speakers, image_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [id, title, summary || null, tag, duration || null, JSON.stringify(chapters), speakers, image_key || null]
  );
  res.status(201).json({ id });
});

/**
 * Replay video, natively stored.
 *
 * Videos land in our own storage (R2 behind the driver) and play through
 * /media with range requests, exactly like feed videos — no third-party
 * video service. Cloudflare's proxy caps a single request at ~100MB and
 * replay files easily exceed that, so the browser sends the file in
 * sequential chunks (32MB each) that are assembled on the media volume,
 * sniffed, and only then promoted to storage.
 */
const VIDEO_TMP = path.join(process.env.MEDIA_ROOT || '/data/media', 'tmp');
const MAX_REPLAY_BYTES = 4 * 1024 * 1024 * 1024; // 4GB — an hour of phone 4K
const REPLAY_VIDEO_MIME = { 'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov' };

/** uploadId -> { replayId, received, bytes, touched } */
const videoUploads = new Map();

// Abandoned uploads: sweep anything untouched for an hour.
setInterval(() => {
  const cutoff = Date.now() - 3600_000;
  for (const [id, u] of videoUploads) {
    if (u.touched < cutoff) {
      videoUploads.delete(id);
      unlink(path.join(VIDEO_TMP, id)).catch(() => {});
    }
  }
}, 600_000).unref();

adminRouter.post('/replays/:id/video/begin', async (req, res) => {
  const { rows } = await q('SELECT id FROM replays WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  await mkdir(VIDEO_TMP, { recursive: true });
  const uploadId = crypto.randomUUID();
  videoUploads.set(uploadId, { replayId: req.params.id, received: 0, bytes: 0, touched: Date.now() });
  res.status(201).json({ upload_id: uploadId, chunk_bytes: 32 * 1024 * 1024 });
});

adminRouter.put(
  '/replays/:id/video/part/:uploadId/:index',
  express.raw({ type: () => true, limit: '40mb' }),
  async (req, res) => {
    const u = videoUploads.get(req.params.uploadId);
    if (!u || u.replayId !== req.params.id) return res.status(404).json({ error: 'no such upload' });
    const index = Number(req.params.index);
    if (index !== u.received) {
      return res.status(409).json({ error: `expected part ${u.received}, got ${index}` });
    }
    if (!req.body?.length) return res.status(400).json({ error: 'empty part' });
    if (u.bytes + req.body.length > MAX_REPLAY_BYTES) {
      videoUploads.delete(req.params.uploadId);
      await unlink(path.join(VIDEO_TMP, req.params.uploadId)).catch(() => {});
      return res.status(413).json({ error: 'video too large (4GB cap)' });
    }
    await appendFile(path.join(VIDEO_TMP, req.params.uploadId), req.body);
    u.received += 1;
    u.bytes += req.body.length;
    u.touched = Date.now();
    res.json({ received: u.received, bytes: u.bytes });
  }
);

adminRouter.post('/replays/:id/video/finish', async (req, res) => {
  const uploadId = req.body?.upload_id;
  const u = videoUploads.get(uploadId);
  if (!u || u.replayId !== req.params.id) return res.status(404).json({ error: 'no such upload' });
  videoUploads.delete(uploadId);
  const tmpFile = path.join(VIDEO_TMP, uploadId);

  try {
    // Trust the assembled bytes, not the picker's file extension.
    const sniffed = await fileTypeFromFile(tmpFile);
    const ext = sniffed && REPLAY_VIDEO_MIME[sniffed.mime];
    if (!ext) {
      return res.status(415).json({ error: 'unsupported video type', detail: 'MP4, WebM or MOV.' });
    }
    const { size } = await stat(tmpFile);

    const owner = await houseMember();
    if (!owner) return res.status(409).json({ error: 'no house member to own the file' });

    const key = storage.makeKey(owner, 'replay', ext);
    const { rows } = await q(
      `INSERT INTO media (owner_id, storage_key, kind, mime_type, byte_size, uploaded)
       VALUES ($1,$2,'replay',$3,$4,false) RETURNING id`,
      [owner, key, sniffed.mime, size]
    );
    try {
      await storage.putFile(key, tmpFile);
    } catch (e) {
      await q('DELETE FROM media WHERE id = $1', [rows[0].id]);
      console.error('[admin replay] store failed:', e.message);
      return res.status(500).json({ error: 'could not store video' });
    }
    await q('UPDATE media SET uploaded = true WHERE id = $1', [rows[0].id]);

    // Swap in the new video; clean up whatever it replaces.
    const prev = await q('SELECT video_key FROM replays WHERE id = $1', [req.params.id]);
    await q('UPDATE replays SET video_key = $2, stream_uid = NULL WHERE id = $1', [req.params.id, key]);
    const oldKey = prev.rows[0]?.video_key;
    if (oldKey && oldKey !== key) {
      try {
        await storage.remove(oldKey);
        await q('DELETE FROM media WHERE storage_key = $1', [oldKey]);
      } catch { /* stray file; the sweep can have it */ }
    }
    res.status(201).json({ video_key: key, bytes: size, mime: sniffed.mime });
  } finally {
    unlink(tmpFile).catch(() => {});
  }
});

adminRouter.get('/replays/:id/video', async (req, res) => {
  const { rows } = await q('SELECT video_key, stream_uid FROM replays WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (rows[0].video_key) return res.json({ attached: true, ready: true, state: 'ready' });
  if (!rows[0].stream_uid) return res.json({ attached: false });
  if (!streamReady) return res.json({ attached: true, ready: false, state: 'stream not connected' });
  res.json({ attached: true, ...(await videoStatus(rows[0].stream_uid)) });
});

adminRouter.patch('/replays/:id', async (req, res) => {
  const { published } = req.body || {};
  if (typeof published !== 'boolean') return res.status(400).json({ error: 'published required' });
  const { rows } = await q('UPDATE replays SET published = $2 WHERE id = $1 RETURNING id', [req.params.id, published]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

adminRouter.delete('/replays/:id', async (req, res) => {
  const { rows } = await q('DELETE FROM replays WHERE id = $1 RETURNING stream_uid, video_key', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (rows[0].video_key) {
    try {
      await storage.remove(rows[0].video_key);
      await q('DELETE FROM media WHERE storage_key = $1', [rows[0].video_key]);
    } catch (e) { console.error('[admin] replay video delete failed:', e.message); }
  }
  if (rows[0].stream_uid && streamReady) {
    try { await deleteVideo(rows[0].stream_uid); }
    catch (e) { console.error('[admin] stream delete failed:', e.message); }
  }
  res.status(204).end();
});

/* ============================================================== workshops */

adminRouter.get('/workshops', async (_req, res) => {
  const { rows } = await q('SELECT * FROM workshops ORDER BY created_at DESC');
  res.json({ workshops: rows });
});

adminRouter.post('/workshops', async (req, res) => {
  const { title, blurb, tag = 'Community', level = 'Beginner', duration, sessions = 1,
          seats_total = 20, host_id, scheduled_for, when_label, outcomes = [], image_key } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!PILLARS.includes(tag)) return res.status(400).json({ error: 'bad tag' });
  const id = contentId(title);
  await q(
    `INSERT INTO workshops (id, title, blurb, tag, level, duration, sessions, seats_total,
                            host_id, scheduled_for, when_label, outcomes, image_key)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [id, title, blurb || null, tag, level, duration || null, sessions, seats_total,
     host_id || null, scheduled_for || null, when_label || null, JSON.stringify(outcomes), image_key || null]
  );
  res.status(201).json({ id });
});

adminRouter.patch('/workshops/:id', async (req, res) => {
  const allowed = { published: 'bool', is_live: 'bool', seats_taken: 'int', when_label: 'text' };
  const sets = [];
  const vals = [];
  for (const [field, kind] of Object.entries(allowed)) {
    if (!(field in (req.body || {}))) continue;
    let v = req.body[field];
    if (kind === 'bool') v = !!v;
    if (kind === 'int') { v = parseInt(v, 10); if (Number.isNaN(v) || v < 0) continue; }
    vals.push(v);
    sets.push(`${field} = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });
  vals.push(req.params.id);
  const { rows } = await q(`UPDATE workshops SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`, vals);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

adminRouter.delete('/workshops/:id', async (req, res) => {
  const { rowCount } = await q('DELETE FROM workshops WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/* ================================================================== rooms */

/**
 * Rooms are created here and only here — Lee's rule: members join rooms,
 * the club runs them. Hosts named at creation walk on stage as moderators
 * (routes.rooms.js already grants that to room_speakers on join).
 */
adminRouter.get('/rooms', async (_req, res) => {
  const { rows } = await q(`
    SELECT r.id, r.title, r.description, r.tag, r.is_live, r.scheduled_for, r.created_at,
           (SELECT count(*)::int FROM room_participants p WHERE p.room_id = r.id) AS in_room,
           (SELECT coalesce(json_agg(json_build_object('id', m.id, 'name', m.name) ORDER BY s.ord), '[]'::json)
              FROM room_speakers s JOIN members m ON m.id = s.member_id
             WHERE s.room_id = r.id) AS hosts
      FROM rooms r ORDER BY r.is_live DESC, r.created_at DESC`);
  res.json({ rooms: rows });
});

adminRouter.post('/rooms', async (req, res) => {
  const { title, description, tag = 'Community', scheduled_for, is_live = false, hosts = [] } = req.body || {};
  if (!title) return res.status(400).json({ error: 'title is required' });
  if (!PILLARS.includes(tag)) return res.status(400).json({ error: 'bad tag' });
  const id = contentId(title);
  await q(
    `INSERT INTO rooms (id, title, description, tag, is_live, scheduled_for)
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [id, title, description || null, tag, !!is_live, scheduled_for || null]
  );
  for (const [i, memberId] of [...new Set(hosts.map(String))].slice(0, 6).entries()) {
    await q(`INSERT INTO room_speakers (room_id, member_id, ord)
             SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM members WHERE id = $2)
             ON CONFLICT DO NOTHING`, [id, memberId, i]).catch(() => {});
  }
  res.status(201).json({ id });
});

adminRouter.patch('/rooms/:id', async (req, res) => {
  const allowed = { title: 'text', description: 'text', is_live: 'bool', scheduled_for: 'text' };
  const sets = [];
  const vals = [];
  for (const [field, kind] of Object.entries(allowed)) {
    if (!(field in (req.body || {}))) continue;
    let v = req.body[field];
    if (kind === 'bool') v = !!v;
    vals.push(v);
    sets.push(`${field} = $${vals.length}`);
  }

  /* Hosts are replaceable after creation — getting them wrong at create
     time must not require deleting the room. New hosts' publish rights
     apply on their next join (token minted from room_speakers). */
  const hosts = Array.isArray(req.body?.hosts) ? req.body.hosts : null;

  if (!sets.length && !hosts) return res.status(400).json({ error: 'nothing to update' });

  if (sets.length) {
    vals.push(req.params.id);
    const { rows } = await q(`UPDATE rooms SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING id`, vals);
    if (!rows[0]) return res.status(404).json({ error: 'not found' });
  } else {
    const exists = await q('SELECT 1 FROM rooms WHERE id = $1', [req.params.id]);
    if (!exists.rows[0]) return res.status(404).json({ error: 'not found' });
  }

  if (hosts) {
    await q('DELETE FROM room_speakers WHERE room_id = $1', [req.params.id]);
    for (const [i, memberId] of [...new Set(hosts.map(String))].slice(0, 6).entries()) {
      await q(`INSERT INTO room_speakers (room_id, member_id, ord)
               SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM members WHERE id = $2)
               ON CONFLICT DO NOTHING`, [req.params.id, memberId, i]).catch(() => {});
    }
  }

  res.json({ ok: true });
});

adminRouter.delete('/rooms/:id', async (req, res) => {
  const { rowCount } = await q('DELETE FROM rooms WHERE id = $1', [req.params.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/* =========================================================== applications */

/**
 * The membership front door. Applications arrive from the public website;
 * everything here is the two-step decision the business asked for:
 * approve (member + allowlist + welcome email, all in one tap) or reject
 * (a gentle email, nothing created).
 */

adminRouter.get('/applications', async (req, res) => {
  const status = ['pending', 'shortlisted', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null;
  const { rows } = await q(`
    SELECT a.*, m.name AS referred_by_name
      FROM applications a
      LEFT JOIN members m ON m.id = a.referral
     ${status ? 'WHERE a.status = $1' : ''}
     ORDER BY (a.status IN ('pending', 'shortlisted')) DESC, a.created_at DESC
     LIMIT 500`, status ? [status] : []);
  res.json({ applications: rows });
});

/** Who can review — the team plus the house admin. For the assign dropdown. */
adminRouter.get('/reviewers', async (_req, res) => {
  let team = [];
  try {
    ({ rows: team } = await q(
      'SELECT username, display_name FROM admin_users WHERE NOT disabled ORDER BY display_name'));
  } catch { /* un-migrated box */ }
  res.json({ reviewers: team.map(t => ({ username: t.username, name: t.display_name })) });
});

/** Shortlist: a holding stage between pending and a decision. No email. */
adminRouter.post('/applications/:id/shortlist', async (req, res) => {
  const { rows } = await q(
    `UPDATE applications SET status = 'shortlisted'
      WHERE id = $1 AND status = 'pending' RETURNING id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'no pending application with that id' });
  res.json({ ok: true });
});

/** Back to the queue from the shortlist. */
adminRouter.post('/applications/:id/unshortlist', async (req, res) => {
  const { rows } = await q(
    `UPDATE applications SET status = 'pending'
      WHERE id = $1 AND status = 'shortlisted' RETURNING id`, [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'no shortlisted application with that id' });
  res.json({ ok: true });
});

adminRouter.patch('/applications/:id', async (req, res) => {
  if (!('assigned_to' in (req.body || {}))) return res.status(400).json({ error: 'nothing to change' });
  const assignee = req.body.assigned_to ? String(req.body.assigned_to).slice(0, 60) : null;
  const { rows } = await q(
    `UPDATE applications SET assigned_to = $2 WHERE id = $1 RETURNING id`,
    [req.params.id, assignee]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

/** Reviewer notes: an append-only trail of {by, at, text}. */
adminRouter.post('/applications/:id/notes', async (req, res) => {
  const text = String(req.body?.text || '').trim().slice(0, 2000);
  if (!text) return res.status(400).json({ error: 'text is required' });
  const note = { by: req.admin.name, at: new Date().toISOString(), text };
  const { rows } = await q(
    `UPDATE applications SET notes = coalesce(notes, '[]'::jsonb) || $2::jsonb
      WHERE id = $1 RETURNING notes`,
    [req.params.id, JSON.stringify(note)]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ notes: rows[0].notes });
});

/**
 * The application funnel, for Marketing: how many started the form, finished
 * part one, finished part two — last 30 days, from the site's anonymous
 * beacons plus the applications table itself.
 */
adminRouter.get('/marketing/funnel', async (_req, res) => {
  let beacons = { apply_started: 0, apply_part1_done: 0, apply_part2_done: 0 };
  try {
    const { rows } = await q(`
      SELECT step, count(*)::int AS n FROM site_events
       WHERE created_at > now() - interval '30 days' GROUP BY step`);
    for (const r of rows) beacons[r.step] = r.n;
  } catch { /* un-migrated box */ }
  const apps = await q(`
    SELECT count(*)::int                                                   AS part1,
           count(*) FILTER (WHERE status <> 'awaiting_details')::int       AS part2,
           count(*) FILTER (WHERE status = 'approved')::int                AS approved
      FROM applications WHERE created_at > now() - interval '30 days'`);
  res.json({ days: 30, beacons, applications: apps.rows[0] });
});

adminRouter.post('/applications/:id/approve', async (req, res) => {
  const { rows } = await q(
    `SELECT * FROM applications WHERE id = $1 AND status IN ('pending', 'shortlisted')`, [req.params.id]
  );
  const app = rows[0];
  if (!app) {
    const half = await q(
      `SELECT status FROM applications WHERE id = $1`, [req.params.id]
    );
    if (half.rows[0]?.status === 'awaiting_details') {
      return res.status(409).json({ error: 'They have not finished part two of their application yet.' });
    }
    return res.status(404).json({ error: 'no pending application with that id' });
  }

  let member;
  try {
    member = await inviteMember({ name: app.name, email: app.email });
  } catch (e) {
    if (e.status !== 409) {
      if (e.status) return res.status(e.status).json({ error: e.error });
      throw e;
    }
    // Already a member — the decision still stands, just attach the row.
    const existing = await q('SELECT id FROM members WHERE lower(email) = lower($1)', [app.email]);
    member = existing.rows[0] || null;
  }

  await q(
    `UPDATE applications SET status = 'approved', member_id = $2, decided_by = $3, decided_at = now()
      WHERE id = $1`,
    [app.id, member?.id || null, req.admin?.username || 'admin']
  );

  /* The store links only appear once the app is actually published; until
     then the web app is the destination and works on any phone. */
  const stores = [
    APP_STORE_URL && `<a href="${APP_STORE_URL}" style="color:#A8894E;">Download on the App Store</a>`,
    PLAY_STORE_URL && `<a href="${PLAY_STORE_URL}" style="color:#A8894E;">Get it on Google Play</a>`,
  ].filter(Boolean);

  sendMail({
    to: app.email,
    cc: 'lee@navada.info',
    subject: 'Welcome to FFG Connect',
    html: ffgEmail(`
      <p style="margin:0 0 6px;text-align:center;font-size:10px;letter-spacing:3px;color:#8A867C;">MEMBERSHIP APPROVED</p>
      <h1 style="margin:6px 0 20px;text-align:center;font-family:Georgia,serif;font-weight:normal;font-size:27px;line-height:1.2;color:#17171B;">
        Welcome to FFG Connect
      </h1>
      <p style="margin:0 0 14px;">Dear ${escapeHtml(app.first_name || app.name.split(' ')[0])},</p>
      <p style="margin:0 0 14px;">
        Your application has been reviewed and approved. We are glad to have you.
      </p>
      <p style="margin:0 0 14px;">
        Connect is the members&rsquo; floor: rooms you can walk into, events worth
        clearing your diary for, and introductions that do not happen anywhere else.
      </p>
      ${emailButton(APP_BASE, 'Open FFG Connect')}
      <p style="margin:0 0 14px;color:#8A867C;font-size:13px;text-align:center;">
        Sign in with Google using <strong style="color:#17171B;">${escapeHtml(app.email)}</strong>.
        Your membership is already waiting for you.
      </p>
      ${stores.length ? `
        <div style="margin:22px 0 0;padding-top:18px;border-top:1px solid #E5E1D6;text-align:center;font-size:13.5px;">
          <p style="margin:0 0 8px;color:#8A867C;">Prefer the app?</p>
          <p style="margin:0;">${stores.join(' &nbsp;&middot;&nbsp; ')}</p>
        </div>` : `
        <div style="margin:22px 0 0;padding-top:18px;border-top:1px solid #E5E1D6;text-align:center;font-size:13px;color:#8A867C;">
          Connect runs in your phone&rsquo;s browser and can be added to your home
          screen like any app. Open the link above, then choose Share and
          &ldquo;Add to Home Screen&rdquo;.
        </div>`}
    `, { footer: 'full' }),
  });

  res.json({ ok: true, member_id: member?.id || null });
});

adminRouter.post('/applications/:id/reject', async (req, res) => {
  const { rows } = await q(
    `UPDATE applications SET status = 'rejected', decided_by = $2, decided_at = now()
      WHERE id = $1 AND status IN ('pending', 'shortlisted') RETURNING name, email`,
    [req.params.id, req.admin?.username || 'admin']
  );
  const app = rows[0];
  if (!app) return res.status(404).json({ error: 'no pending application with that id' });

  sendMail({
    to: app.email,
    cc: 'lee@navada.info',
    subject: 'Your Forbes Family Group application',
    html: ffgEmail(`
      <p style="margin:0 0 14px;">Dear ${escapeHtml(app.name.split(' ')[0])},</p>
      <p style="margin:0 0 14px;">Thank you for your interest in Forbes Family Group and for
      taking the time to apply.</p>
      <p style="margin:0 0 14px;">Membership of Connect is limited, and we are unable to offer
      you a place at this time. Applications reopen regularly, and we would be glad to see
      yours again.</p>
      <p style="margin:14px 0 0;">Forbes Family Group</p>
    `),
  });

  res.json({ ok: true });
});

/* =========================================================== site content */

/** The website's CMS: every editable slot on forbesfamilygroup's front door. */

adminRouter.get('/site-content', async (_req, res) => {
  const { rows } = await q('SELECT key, value, updated_at, updated_by FROM site_content ORDER BY key');
  const content = {};
  const meta = {};
  for (const row of rows) {
    content[row.key] = row.value;
    meta[row.key] = { updated_at: row.updated_at, updated_by: row.updated_by };
  }
  res.json({ content, meta });
});

adminRouter.put('/site-content/:key', async (req, res) => {
  const key = String(req.params.key).slice(0, 60);
  const { value } = req.body || {};
  if (value === undefined) return res.status(400).json({ error: 'value is required' });
  await q(
    `INSERT INTO site_content (key, value, updated_at, updated_by) VALUES ($1, $2, now(), $3)
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now(), updated_by = $3`,
    [key, JSON.stringify(value), req.admin.name]
  );
  res.json({ ok: true });
});

adminRouter.delete('/site-content/:key', async (req, res) => {
  await q('DELETE FROM site_content WHERE key = $1', [String(req.params.key).slice(0, 60)]);
  res.status(204).end();
});

/* =================================================================== team */

/**
 * Named admin accounts (Ann, Charlene, …). Superadmin-only by the scope
 * rules above. Passwords arrive plain over TLS and are hashed here; the
 * response never carries a hash.
 */

const TEAM_SCOPES = ['website', 'marketing', 'applications'];
const cleanScopes = (scopes) =>
  Array.isArray(scopes) ? scopes.filter(s => TEAM_SCOPES.includes(s)) : [];

adminRouter.get('/team', async (_req, res) => {
  const { rows } = await q(
    'SELECT username, display_name, scopes, disabled, created_at, last_login_at FROM admin_users ORDER BY created_at');
  res.json({ team: rows, available_scopes: TEAM_SCOPES });
});

adminRouter.post('/team', async (req, res) => {
  const { username, display_name, password, scopes } = req.body || {};
  const uname = String(username || '').toLowerCase().trim();
  if (!/^[a-z0-9_.-]{2,40}$/.test(uname)) return res.status(400).json({ error: 'username: 2–40 chars, letters/numbers/._-' });
  if (!display_name || typeof display_name !== 'string') return res.status(400).json({ error: 'display name is required' });
  if (typeof password !== 'string' || password.length < 10) return res.status(400).json({ error: 'password must be at least 10 characters' });
  const hash = await bcrypt.hash(password, 12);
  try {
    await q(
      `INSERT INTO admin_users (username, display_name, password_hash, scopes)
       VALUES ($1, $2, $3, $4)`,
      [uname, display_name.trim(), hash, cleanScopes(scopes)]
    );
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'that username already exists' });
    throw e;
  }
  res.status(201).json({ ok: true, username: uname });
});

adminRouter.patch('/team/:username', async (req, res) => {
  const uname = String(req.params.username).toLowerCase();
  const { display_name, scopes, disabled, password } = req.body || {};
  const sets = [];
  const vals = [uname];
  if (typeof display_name === 'string' && display_name.trim()) {
    vals.push(display_name.trim()); sets.push(`display_name = $${vals.length}`);
  }
  if (scopes !== undefined) {
    vals.push(cleanScopes(scopes)); sets.push(`scopes = $${vals.length}`);
  }
  if (typeof disabled === 'boolean') {
    vals.push(disabled); sets.push(`disabled = $${vals.length}`);
  }
  if (password !== undefined) {
    if (typeof password !== 'string' || password.length < 10) {
      return res.status(400).json({ error: 'password must be at least 10 characters' });
    }
    vals.push(await bcrypt.hash(password, 12)); sets.push(`password_hash = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to change' });
  const { rows } = await q(
    `UPDATE admin_users SET ${sets.join(', ')} WHERE username = $1 RETURNING username`, vals);
  if (!rows[0]) return res.status(404).json({ error: 'no such account' });
  res.json({ ok: true });
});

adminRouter.delete('/team/:username', async (req, res) => {
  await q('DELETE FROM admin_users WHERE username = $1', [String(req.params.username).toLowerCase()]);
  res.status(204).end();
});

/* ============================================================== marketing */

/**
 * Campaigns and the asset library. Open to the 'marketing' scope. Assets
 * ride the same media pipeline as everything else (R2 behind the driver);
 * the marketing_assets row adds title, tags and the campaign link.
 */

const utmSlug = (s) => String(s || '').toLowerCase()
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

adminRouter.get('/marketing/campaigns', async (_req, res) => {
  const { rows } = await q(`
    SELECT c.*, (SELECT count(*)::int FROM marketing_assets a WHERE a.campaign_id = c.id) AS asset_count
      FROM campaigns c
     ORDER BY (c.status = 'archived'), c.created_at DESC`);
  res.json({ campaigns: rows });
});

adminRouter.post('/marketing/campaigns', async (req, res) => {
  const { name, status, objective, audience, channels, start_date, end_date, budget_pence, brief } = req.body || {};
  if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
  const st = ['draft', 'planned', 'active', 'completed', 'archived'].includes(status) ? status : 'draft';
  const budget = Number.isInteger(budget_pence) && budget_pence >= 0 ? budget_pence : null;
  const { rows } = await q(
    `INSERT INTO campaigns (name, status, objective, audience, channels, start_date, end_date, budget_pence, brief, utm_campaign, created_by)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
    [name.trim(), st, String(objective || ''), String(audience || ''),
     Array.isArray(channels) ? channels.slice(0, 12).map(String) : [],
     start_date || null, end_date || null, budget, String(brief || ''),
     utmSlug(name), req.admin.name]
  );
  res.status(201).json(rows[0]);
});

adminRouter.patch('/marketing/campaigns/:id', async (req, res) => {
  const allowed = {
    name: (v) => typeof v === 'string' && v.trim() ? v.trim() : undefined,
    status: (v) => ['draft', 'planned', 'active', 'completed', 'archived'].includes(v) ? v : undefined,
    objective: (v) => typeof v === 'string' ? v : undefined,
    audience: (v) => typeof v === 'string' ? v : undefined,
    channels: (v) => Array.isArray(v) ? v.slice(0, 12).map(String) : undefined,
    start_date: (v) => v === null || typeof v === 'string' ? v : undefined,
    end_date: (v) => v === null || typeof v === 'string' ? v : undefined,
    budget_pence: (v) => v === null || (Number.isInteger(v) && v >= 0) ? v : undefined,
    brief: (v) => typeof v === 'string' ? v : undefined,
    utm_campaign: (v) => typeof v === 'string' ? utmSlug(v) : undefined,
  };
  const sets = [];
  const vals = [req.params.id];
  for (const [field, clean] of Object.entries(allowed)) {
    if (!(field in (req.body || {}))) continue;
    const v = clean(req.body[field]);
    if (v === undefined) return res.status(400).json({ error: `invalid ${field}` });
    vals.push(v); sets.push(`${field} = $${vals.length}`);
  }
  if (!sets.length) return res.status(400).json({ error: 'nothing to change' });
  const { rows } = await q(
    `UPDATE campaigns SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 RETURNING *`, vals);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json(rows[0]);
});

adminRouter.delete('/marketing/campaigns/:id', async (req, res) => {
  await q('DELETE FROM campaigns WHERE id = $1', [req.params.id]);
  res.status(204).end(); // assets survive: campaign_id falls to NULL
});

adminRouter.get('/marketing/assets', async (req, res) => {
  const campaign = req.query.campaign_id || null;
  const { rows } = await q(`
    SELECT a.id, a.title, a.tags, a.campaign_id, a.uploaded_by, a.created_at,
           m.storage_key AS key, m.mime_type, m.byte_size, m.width, m.height
      FROM marketing_assets a JOIN media m ON m.id = a.media_id
     WHERE $1::uuid IS NULL OR a.campaign_id = $1
     ORDER BY a.created_at DESC`, [campaign]);
  res.json({ assets: rows });
});

adminRouter.post('/marketing/assets', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const stored = await storeAdminFile(req.file, { kind: 'marketing', allow: MARKETING_EXT });
  if (stored.error === 415) return res.status(415).json({ error: 'Images, video, audio, PDF, Office documents or ZIP only' });
  if (stored.error === 409) return res.status(409).json({ error: 'no house member to own the file' });
  if (stored.error) return res.status(500).json({ error: 'could not store file' });

  const title = String(req.body?.title || req.file.originalname || '').slice(0, 200);
  const tags = String(req.body?.tags || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).slice(0, 12);
  const campaign = req.body?.campaign_id || null;
  const { rows } = await q(
    `INSERT INTO marketing_assets (media_id, campaign_id, title, tags, uploaded_by)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id, title, tags, campaign_id, uploaded_by, created_at`,
    [stored.id, campaign, title, tags, req.admin.name]
  );
  res.status(201).json({
    ...rows[0], key: stored.key, mime_type: stored.mime, byte_size: stored.bytes,
    width: stored.width || null, height: stored.height || null,
  });
});

adminRouter.patch('/marketing/assets/:id', async (req, res) => {
  const { title, tags, campaign_id } = req.body || {};
  const sets = [];
  const vals = [req.params.id];
  if (typeof title === 'string') { vals.push(title.slice(0, 200)); sets.push(`title = $${vals.length}`); }
  if (Array.isArray(tags)) {
    vals.push(tags.map(s => String(s).trim().toLowerCase()).filter(Boolean).slice(0, 12));
    sets.push(`tags = $${vals.length}`);
  }
  if (campaign_id !== undefined) { vals.push(campaign_id || null); sets.push(`campaign_id = $${vals.length}`); }
  if (!sets.length) return res.status(400).json({ error: 'nothing to change' });
  const { rows } = await q(
    `UPDATE marketing_assets SET ${sets.join(', ')} WHERE id = $1 RETURNING id`, vals);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

adminRouter.delete('/marketing/assets/:id', async (req, res) => {
  const { rows } = await q(
    `SELECT a.media_id, m.storage_key FROM marketing_assets a JOIN media m ON m.id = a.media_id WHERE a.id = $1`,
    [req.params.id]);
  if (rows[0]) {
    await storage.remove(rows[0].storage_key);
    await q('DELETE FROM media WHERE id = $1', [rows[0].media_id]); // cascades the asset row
  }
  res.status(204).end();
});

/* =============================================================== payments */

adminRouter.get('/payments', async (_req, res) => {
  const { rows } = await q(`
    SELECT p.*, m.name AS member_name, m.handle AS member_handle
      FROM payments p LEFT JOIN members m ON m.id = p.member_id
     ORDER BY p.created_at DESC`);
  res.json({ payments: rows, stripe: { connected: stripeReady, test_mode: stripeTestMode } });
});

adminRouter.post('/payments', async (req, res) => {
  const { member_id, amount_pence, description } = req.body || {};
  const amount = parseInt(amount_pence, 10);
  if (!member_id || !description || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'member_id, description and a positive amount_pence are required' });
  }
  const member = await q('SELECT id FROM members WHERE id = $1', [member_id]);
  if (!member.rows[0]) return res.status(404).json({ error: 'no such member' });

  const siteBase = process.env.PUBLIC_SITE_BASE || 'https://connect.navada-edge-server.uk';
  const payment = await createPayment({ memberId: member_id, amountPence: amount, description, siteBase });
  res.status(201).json(payment);
});

/** Money that arrived outside Stripe — bank transfer, cash. Same ledger. */
adminRouter.post('/payments/manual', async (req, res) => {
  const { member_id, amount_pence, description } = req.body || {};
  const amount = parseInt(amount_pence, 10);
  if (!member_id || !description || !Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'member_id, description and a positive amount_pence are required' });
  }
  const { rows } = await q(
    `INSERT INTO payments (id, member_id, amount_pence, description, method, status, paid_at)
     VALUES ($1,$2,$3,$4,'manual','paid',now()) RETURNING *`,
    [payId(), member_id, amount, description]
  );
  res.status(201).json(rows[0]);
});

adminRouter.patch('/payments/:id', async (req, res) => {
  const { status } = req.body || {};
  if (!['paid', 'void', 'refunded'].includes(status)) {
    return res.status(400).json({ error: 'status must be paid, void or refunded' });
  }
  const { rows } = await q(
    `UPDATE payments SET status = $2, paid_at = CASE WHEN $2 = 'paid' THEN coalesce(paid_at, now()) ELSE paid_at END
      WHERE id = $1 RETURNING id`, [req.params.id, status]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  res.json({ ok: true });
});

adminRouter.get('/payments.csv', async (_req, res) => {
  const { rows } = await q(`
    SELECT p.id, m.name AS member, p.description, p.amount_pence, p.currency,
           p.status, p.method, p.created_at, p.paid_at
      FROM payments p LEFT JOIN members m ON m.id = p.member_id
     ORDER BY p.created_at`);
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const head = 'id,member,description,amount,currency,status,method,created,paid';
  const lines = rows.map(r => [
    r.id, r.member, r.description, (r.amount_pence / 100).toFixed(2), r.currency,
    r.status, r.method, r.created_at?.toISOString() || '', r.paid_at?.toISOString() || '',
  ].map(esc).join(','));
  res.set('Content-Type', 'text/csv');
  res.set('Content-Disposition', 'attachment; filename="ffg-payments.csv"');
  res.send([head, ...lines].join('\n'));
});
