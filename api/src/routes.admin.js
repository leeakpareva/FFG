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
import { Router } from 'express';
import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import crypto from 'node:crypto';
import { createClerkClient } from '@clerk/backend';
import { q, pool } from './db.js';
import { requireSuperAdmin } from './adminAuth.js';
import * as storage from './storage.js';
import { directUploadUrl, videoStatus, deleteVideo, streamReady } from './stream.js';
import { createPayment, stripeReady, stripeTestMode, payId } from './stripe.js';
import { reindexAll, embedReady } from './embed.js';

export const adminRouter = Router();
adminRouter.use(requireSuperAdmin);

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
 * Invite: pre-create the row. resolveMember() in auth.js claims it by email
 * the first time that person signs in with Google — no invite email is sent
 * from here, Lee tells them himself.
 */
adminRouter.post('/members', async (req, res) => {
  const { name, email, role = 'Member', pillar = 'Community' } = req.body || {};
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });
  if (!PILLARS.includes(pillar)) return res.status(400).json({ error: 'bad pillar' });

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
      return res.status(201).json(rows[0]);
    } catch (e) {
      if (e.code !== '23505') throw e;
      if (/email/.test(e.constraint || '')) {
        return res.status(409).json({ error: 'a member with that email already exists' });
      }
    }
  }
  res.status(500).json({ error: 'could not find a free id' });
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
  const { rows } = await q('SELECT id, clerk_id FROM members WHERE id = $1', [req.params.id]);
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
  res.status(204).end();
});

/* ================================================================== media */

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024, files: 1 } });
const MEDIA_EXT = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif',
  'video/mp4': 'mp4', 'video/webm': 'webm', 'video/quicktime': 'mov',
};

/** Covers, thumbnails and clips for content. Owned by the house account. */
adminRouter.post('/media', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file' });
  const sniffed = await fileTypeFromBuffer(req.file.buffer);
  const ext = sniffed && MEDIA_EXT[sniffed.mime];
  if (!ext) return res.status(415).json({ error: 'Images (JPEG, PNG, WebP, GIF) or video (MP4, WebM, MOV) only' });

  const owner = await houseMember();
  if (!owner) return res.status(409).json({ error: 'no house member to own the file' });

  const key = storage.makeKey(owner, 'article', ext);
  const { rows } = await q(
    `INSERT INTO media (owner_id, storage_key, kind, mime_type, byte_size, uploaded)
     VALUES ($1,$2,'article',$3,$4,false) RETURNING id, storage_key`,
    [owner, key, sniffed.mime, req.file.size]
  );
  try {
    await storage.put(key, req.file.buffer);
  } catch (e) {
    await q('DELETE FROM media WHERE id = $1', [rows[0].id]);
    console.error('[admin media] write failed', e.message);
    return res.status(500).json({ error: 'could not store file' });
  }
  await q('UPDATE media SET uploaded = true WHERE id = $1', [rows[0].id]);
  res.status(201).json({ id: rows[0].id, key, url: `/media/${key}` });
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
  const { rows } = await q('SELECT * FROM events ORDER BY starts_at NULLS LAST, created_at DESC');
  res.json({ events: rows });
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

/** Asks Stream for a direct-upload URL and pins the resulting uid to the row. */
adminRouter.post('/replays/:id/video', async (req, res) => {
  if (!streamReady) return res.status(503).json({ error: 'Stream is not connected' });
  const { rows } = await q('SELECT id, title FROM replays WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const { uploadURL, uid } = await directUploadUrl({ name: rows[0].title });
  await q('UPDATE replays SET stream_uid = $2 WHERE id = $1', [req.params.id, uid]);
  res.json({ uploadURL, uid });
});

adminRouter.get('/replays/:id/video', async (req, res) => {
  const { rows } = await q('SELECT stream_uid FROM replays WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
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
  const { rows } = await q('DELETE FROM replays WHERE id = $1 RETURNING stream_uid', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
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
