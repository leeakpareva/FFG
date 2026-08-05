/**
 * The social layer: posts, likes, follows and direct messages. Everything
 * lands in Postgres; nothing here is decorative.
 *
 * Identity always comes from the verified token (req.member), never the
 * body — the same discipline as everywhere else in this API.
 */
import { Router } from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { track, trackPing } from './track.js';
import { embedPost } from './embed.js';

export const socialRouter = Router();

/* ------------------------------------------------------------- presence */

/** One a minute from each open app. Feeds "time in app" on the admin side. */
socialRouter.post('/presence', requireMember, (req, res) => {
  trackPing(req.member.id);
  res.status(204).end();
});

/* ---------------------------------------------------------------- posts */

const POST_SELECT = `
  SELECT p.id, p.member_id, p.body, p.pillar, p.image_key, p.stat_label,
         p.stat_value, p.posted_at,
         m.name AS author_name, m.handle AS author_handle, m.verified AS author_verified,
         av.storage_key AS author_avatar_key,
         (SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
         EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $1) AS liked_by_me
    FROM posts p
    JOIN members m ON m.id = p.member_id
    LEFT JOIN media av ON av.id = m.avatar_media_id`;

const shapePost = (r) => ({
  id: r.id,
  uid: r.member_id,
  author: {
    name: r.author_name,
    handle: r.author_handle,
    verified: r.author_verified,
    avatar_url: r.author_avatar_key ? `/media/${r.author_avatar_key}` : null,
  },
  text: r.body,
  pillar: r.pillar,
  image_url: r.image_key ? `/media/${r.image_key}` : null,
  stat: r.stat_label ? { label: r.stat_label, value: r.stat_value } : null,
  likes: r.likes,
  liked: r.liked_by_me,
  posted_at: r.posted_at,
});

/**
 * The feed, ranked the way the big ones do it: retrieval by interest
 * (embedding similarity between you and the post), then engagement and
 * social signals, with freshness keeping it alive. Everything degrades —
 * a post or member without a vector simply ranks on the other terms.
 *
 *   score = 2.0 × interest similarity        (what you're about)
 *         + 0.8 × you follow the author      (your graph)
 *         + 0.05 × likes                     (what the room liked)
 *         + freshness (half-life ~ a day)    (recency floor)
 */
socialRouter.get('/posts', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT p.id, p.member_id, p.body, p.pillar, p.image_key, p.stat_label,
           p.stat_value, p.posted_at,
           m.name AS author_name, m.handle AS author_handle, m.verified AS author_verified,
           av.storage_key AS author_avatar_key,
           (SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
           EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $1) AS liked_by_me,
           (CASE WHEN p.embedding IS NOT NULL AND me.embedding IS NOT NULL
                 THEN 2.0 * (1 - (p.embedding <=> me.embedding)) ELSE 0 END)
           + (CASE WHEN EXISTS (SELECT 1 FROM follows f
                      WHERE f.follower_id = $1 AND f.followee_id = p.member_id)
                   THEN 0.8 ELSE 0 END)
           + 0.05 * (SELECT count(*) FROM post_likes pl WHERE pl.post_id = p.id)
           + 1.0 / (1 + EXTRACT(EPOCH FROM (now() - p.posted_at)) / 86400)
             AS rank_score
      FROM posts p
      JOIN members m ON m.id = p.member_id
      JOIN members me ON me.id = $1
      LEFT JOIN media av ON av.id = m.avatar_media_id
     ORDER BY rank_score DESC
     LIMIT 100`, [req.member.id]);
  res.json({ posts: rows.map(shapePost) });
});

socialRouter.post('/posts', requireMember, async (req, res) => {
  const { body, pillar, image_key } = req.body || {};
  if (!body || !String(body).trim()) return res.status(400).json({ error: 'body is required' });
  if (!['Capital', 'Community', 'Connect'].includes(pillar)) return res.status(400).json({ error: 'bad pillar' });

  /* An image key can only be one of your own uploads — otherwise any member
     could hang someone else's photo on their post. */
  if (image_key) {
    const owned = await q('SELECT 1 FROM media WHERE storage_key = $1 AND owner_id = $2 AND uploaded',
      [image_key, req.member.id]);
    if (!owned.rows[0]) return res.status(403).json({ error: 'that image is not yours' });
  }

  const { rows } = await q(
    `INSERT INTO posts (member_id, body, pillar, image_key) VALUES ($1,$2,$3,$4) RETURNING id`,
    [req.member.id, String(body).trim().slice(0, 2000), pillar, image_key || null]
  );
  track(req.member.id, 'post_created', { post: rows[0].id });
  embedPost(rows[0].id, body); // async — ranking learns this post shortly
  const full = await q(`${POST_SELECT} WHERE p.id = $2`, [req.member.id, rows[0].id]);
  res.status(201).json(shapePost(full.rows[0]));
});

socialRouter.post('/posts/:id/like', requireMember, async (req, res) => {
  /* Toggle: one row per member per post, the table enforces it. */
  const del = await q('DELETE FROM post_likes WHERE post_id = $1 AND member_id = $2', [req.params.id, req.member.id]);
  if (!del.rowCount) {
    try {
      await q('INSERT INTO post_likes (post_id, member_id) VALUES ($1, $2)', [req.params.id, req.member.id]);
    } catch (e) {
      if (e.code === '23503') return res.status(404).json({ error: 'no such post' });
      throw e;
    }
  }
  const { rows } = await q('SELECT count(*)::int AS likes FROM post_likes WHERE post_id = $1', [req.params.id]);
  res.json({ likes: rows[0].likes, liked: !del.rowCount });
});

socialRouter.delete('/posts/:id', requireMember, async (req, res) => {
  /* Your own posts only; admins can remove anything. */
  const { rowCount } = await q(
    req.member.is_admin
      ? 'DELETE FROM posts WHERE id = $1'
      : 'DELETE FROM posts WHERE id = $1 AND member_id = $2',
    req.member.is_admin ? [req.params.id] : [req.params.id, req.member.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/* -------------------------------------------------------------- follows */

socialRouter.post('/members/:id/follow', requireMember, async (req, res) => {
  if (req.params.id === req.member.id) return res.status(400).json({ error: 'that is you' });
  const del = await q('DELETE FROM follows WHERE follower_id = $1 AND followee_id = $2',
    [req.member.id, req.params.id]);
  if (!del.rowCount) {
    try {
      await q('INSERT INTO follows (follower_id, followee_id) VALUES ($1, $2)', [req.member.id, req.params.id]);
      track(req.member.id, 'follow', { followee: req.params.id });
    } catch (e) {
      if (e.code === '23503') return res.status(404).json({ error: 'no such member' });
      throw e;
    }
  }
  res.json({ following: !del.rowCount });
});

/* ------------------------------------------------------------- messages */

/** Threads are stored with the pair ordered, so one pair is ever one row. */
const pair = (a, b) => (a < b ? [a, b] : [b, a]);

socialRouter.get('/threads', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT t.id,
           CASE WHEN t.member_a = $1 THEN t.member_b ELSE t.member_a END AS other_id,
           m.name AS other_name, m.handle AS other_handle,
           av.storage_key AS other_avatar_key,
           last.body AS last_body, last.created_at AS last_at, last.sender_id AS last_sender,
           (SELECT count(*)::int FROM messages x
             WHERE x.thread_id = t.id AND x.sender_id <> $1 AND x.read_at IS NULL) AS unread
      FROM threads t
      JOIN members m ON m.id = CASE WHEN t.member_a = $1 THEN t.member_b ELSE t.member_a END
      LEFT JOIN media av ON av.id = m.avatar_media_id
      LEFT JOIN LATERAL (
        SELECT body, created_at, sender_id FROM messages
         WHERE thread_id = t.id ORDER BY created_at DESC LIMIT 1
      ) last ON true
     WHERE t.member_a = $1 OR t.member_b = $1
     ORDER BY last.created_at DESC NULLS LAST`, [req.member.id]);
  res.json({
    threads: rows.map(r => ({
      id: r.id,
      other: {
        id: r.other_id, name: r.other_name, handle: r.other_handle,
        avatar_url: r.other_avatar_key ? `/media/${r.other_avatar_key}` : null,
      },
      last: r.last_body,
      last_at: r.last_at,
      last_mine: r.last_sender === req.member.id,
      unread: r.unread,
    })),
  });
});

/** Get-or-create the thread with one other member. */
socialRouter.post('/threads', requireMember, async (req, res) => {
  const other = req.body?.member_id;
  if (!other || other === req.member.id) return res.status(400).json({ error: 'member_id required' });
  const exists = await q('SELECT 1 FROM members WHERE id = $1', [other]);
  if (!exists.rows[0]) return res.status(404).json({ error: 'no such member' });

  const [a, b] = pair(req.member.id, other);
  const { rows } = await q(`
    INSERT INTO threads (member_a, member_b) VALUES ($1, $2)
    ON CONFLICT (member_a, member_b) DO UPDATE SET member_a = threads.member_a
    RETURNING id`, [a, b]);
  res.json({ id: rows[0].id });
});

/** Only a participant may read a thread; the WHERE enforces it. */
socialRouter.get('/threads/:id/messages', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT ms.id, ms.sender_id, ms.body, ms.created_at
      FROM messages ms
      JOIN threads t ON t.id = ms.thread_id
     WHERE ms.thread_id = $1 AND (t.member_a = $2 OR t.member_b = $2)
     ORDER BY ms.created_at
     LIMIT 500`, [req.params.id, req.member.id]);
  /* Opening the thread is reading it. */
  await q(`UPDATE messages SET read_at = now()
            WHERE thread_id = $1 AND sender_id <> $2 AND read_at IS NULL`,
    [req.params.id, req.member.id]);
  res.json({
    messages: rows.map(m => ({
      id: m.id, me: m.sender_id === req.member.id, text: m.body, at: m.created_at,
    })),
  });
});

socialRouter.post('/threads/:id/messages', requireMember, async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });

  const member = await q('SELECT 1 FROM threads WHERE id = $1 AND (member_a = $2 OR member_b = $2)',
    [req.params.id, req.member.id]);
  if (!member.rows[0]) return res.status(404).json({ error: 'no such thread' });

  const { rows } = await q(
    `INSERT INTO messages (thread_id, sender_id, body) VALUES ($1,$2,$3) RETURNING id, created_at`,
    [req.params.id, req.member.id, body.slice(0, 2000)]
  );
  track(req.member.id, 'message_sent', { thread: req.params.id });
  res.status(201).json({ id: rows[0].id, me: true, text: body, at: rows[0].created_at });
});
