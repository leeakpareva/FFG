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
import { notify } from './ws.js';

export const socialRouter = Router();

/* ------------------------------------------------------------- presence */

/** One a minute from each open app. Feeds "time in app" on the admin side. */
socialRouter.post('/presence', requireMember, (req, res) => {
  trackPing(req.member.id);
  res.status(204).end();
});

/* ---------------------------------------------------------------- posts */

const TAGS_SQL = `
  (SELECT coalesce(json_agg(json_build_object('id', tm.id, 'name', tm.name, 'handle', tm.handle)), '[]'::json)
     FROM post_tags pt JOIN members tm ON tm.id = pt.member_id
    WHERE pt.post_id = p.id) AS tags`;

const POST_SELECT = `
  SELECT p.id, p.member_id, p.body, p.pillar, p.image_key, p.stat_label,
         p.stat_value, p.posted_at,
         m.name AS author_name, m.handle AS author_handle, m.verified AS author_verified,
         av.storage_key AS author_avatar_key,
         (SELECT count(*)::int FROM post_likes pl WHERE pl.post_id = p.id) AS likes,
         EXISTS (SELECT 1 FROM post_likes pl WHERE pl.post_id = p.id AND pl.member_id = $1) AS liked_by_me,
         EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.member_id = $1) AS saved_by_me,
         (SELECT count(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments,
         ${TAGS_SQL}
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
  comments: r.comments ?? 0,
  tags: r.tags || [],
  saved: r.saved_by_me ?? false,
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
           EXISTS (SELECT 1 FROM post_saves ps WHERE ps.post_id = p.id AND ps.member_id = $1) AS saved_by_me,
         (SELECT count(*)::int FROM post_comments pc WHERE pc.post_id = p.id) AS comments,
           ${TAGS_SQL},
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

/** A member's own posts — the profile grid. Anyone signed in may look. */
socialRouter.get('/members/:id/posts', requireMember, async (req, res) => {
  const { rows } = await q(
    `${POST_SELECT} WHERE p.member_id = $2 ORDER BY p.posted_at DESC LIMIT 100`,
    [req.member.id, req.params.id]
  );
  res.json({ posts: rows.map(shapePost) });
});

/** Posts this member is tagged in — the profile's second tab. */
socialRouter.get('/members/:id/tagged', requireMember, async (req, res) => {
  const { rows } = await q(
    `${POST_SELECT}
      WHERE EXISTS (SELECT 1 FROM post_tags pt
                     WHERE pt.post_id = p.id AND pt.member_id = $2)
      ORDER BY p.posted_at DESC LIMIT 100`,
    [req.member.id, req.params.id]
  );
  res.json({ posts: rows.map(shapePost) });
});

socialRouter.post('/posts', requireMember, async (req, res) => {
  const { body, pillar, image_key, tags } = req.body || {};
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

  /* Tags: only real members, never yourself, capped so a post cannot tag
     the whole club. Bad ids are dropped rather than failing the post. */
  if (Array.isArray(tags) && tags.length) {
    const ids = [...new Set(tags.map(String))].filter(t => t !== req.member.id).slice(0, 10);
    for (const id of ids) {
      await q(`INSERT INTO post_tags (post_id, member_id)
               SELECT $1, $2 WHERE EXISTS (SELECT 1 FROM members WHERE id = $2)
               ON CONFLICT DO NOTHING`, [rows[0].id, id]).catch(() => {});
    }
  }

  const full = await q(`${POST_SELECT} WHERE p.id = $2`, [req.member.id, rows[0].id]);
  notify(null, { type: 'post', from: req.member.id }); // the feed has news
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

/** Edit your own post — the words only; media stays what it was. */
socialRouter.patch('/posts/:id', requireMember, async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  const { rowCount } = await q(
    'UPDATE posts SET body = $2 WHERE id = $1 AND member_id = $3',
    [req.params.id, body.slice(0, 2000), req.member.id]
  );
  if (!rowCount) return res.status(404).json({ error: 'not found or not yours' });
  embedPost(req.params.id, body); // the ranking re-learns the edited words
  res.json({ ok: true, body: body.slice(0, 2000) });
});

/* -------------------------------------------------------------- comments */

socialRouter.get('/posts/:id/comments', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT c.id, c.member_id, c.body, c.created_at,
           m.name AS author_name, m.handle AS author_handle,
           av.storage_key AS author_avatar_key
      FROM post_comments c
      JOIN members m ON m.id = c.member_id
      LEFT JOIN media av ON av.id = m.avatar_media_id
     WHERE c.post_id = $1
     ORDER BY c.created_at
     LIMIT 200`, [req.params.id]);
  res.json({
    comments: rows.map(c => ({
      id: c.id,
      uid: c.member_id,
      mine: c.member_id === req.member.id,
      author: {
        name: c.author_name, handle: c.author_handle,
        avatar_url: c.author_avatar_key ? `/media/${c.author_avatar_key}` : null,
      },
      text: c.body,
      at: c.created_at,
    })),
  });
});

socialRouter.post('/posts/:id/comments', requireMember, async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  try {
    const { rows } = await q(
      `INSERT INTO post_comments (post_id, member_id, body)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.params.id, req.member.id, body.slice(0, 1000)]
    );
    track(req.member.id, 'comment', { post: req.params.id });
    notify(null, { type: 'comment', post: req.params.id, from: req.member.id });
    res.status(201).json({
      id: rows[0].id, uid: req.member.id, mine: true,
      author: { name: req.member.name, handle: req.member.handle, avatar_url: null },
      text: body.slice(0, 1000), at: rows[0].created_at,
    });
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'no such post' });
    throw e;
  }
});

/** Your own comment, or any comment on your own post, or admin. */
socialRouter.delete('/comments/:id', requireMember, async (req, res) => {
  const { rowCount } = await q(`
    DELETE FROM post_comments c
     WHERE c.id = $1
       AND ($2 OR c.member_id = $3
            OR EXISTS (SELECT 1 FROM posts p WHERE p.id = c.post_id AND p.member_id = $3))`,
    [req.params.id, req.member.is_admin, req.member.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

/** Bookmark toggle — same shape as like. */
socialRouter.post('/posts/:id/save', requireMember, async (req, res) => {
  const del = await q('DELETE FROM post_saves WHERE post_id = $1 AND member_id = $2', [req.params.id, req.member.id]);
  if (!del.rowCount) {
    try {
      await q('INSERT INTO post_saves (post_id, member_id) VALUES ($1, $2)', [req.params.id, req.member.id]);
    } catch (e) {
      if (e.code === '23503') return res.status(404).json({ error: 'no such post' });
      throw e;
    }
  }
  res.json({ saved: !del.rowCount });
});

/** The saved list — newest bookmark first. */
socialRouter.get('/me/saved', requireMember, async (req, res) => {
  const { rows } = await q(`
    ${POST_SELECT}
    JOIN post_saves sv ON sv.post_id = p.id AND sv.member_id = $1
    ORDER BY sv.created_at DESC LIMIT 100`, [req.member.id]);
  res.json({ posts: rows.map(shapePost) });
});

/**
 * Report a member. It lands in usage_events, which means it surfaces in
 * the admin panel's activity views — the FFG team actually sees it.
 */
socialRouter.post('/members/:id/report', requireMember, async (req, res) => {
  const exists = await q('SELECT 1 FROM members WHERE id = $1', [req.params.id]);
  if (!exists.rows[0]) return res.status(404).json({ error: 'no such member' });
  track(req.member.id, 'report', {
    member: req.params.id,
    reason: String(req.body?.reason || '').slice(0, 300) || 'unspecified',
  });
  res.status(201).json({ ok: true });
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

const FOLLOW_LIST = (direction) => `
  SELECT m.id, m.name, m.handle, m.role, m.pillar, m.verified,
         av.storage_key AS avatar_key,
         EXISTS (SELECT 1 FROM follows f2
                  WHERE f2.follower_id = $1 AND f2.followee_id = m.id) AS followed_by_me
    FROM follows f
    JOIN members m ON m.id = f.${direction === 'followers' ? 'follower_id' : 'followee_id'}
    LEFT JOIN media av ON av.id = m.avatar_media_id
   WHERE f.${direction === 'followers' ? 'followee_id' : 'follower_id'} = $2
   ORDER BY f.created_at DESC LIMIT 200`;

const shapeFollow = (r) => ({
  id: r.id, name: r.name, handle: r.handle, role: r.role, pillar: r.pillar,
  verified: r.verified, avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null,
  followed_by_me: r.followed_by_me,
});

/** Who follows this member — the tap on the Followers number. */
socialRouter.get('/members/:id/followers', requireMember, async (req, res) => {
  const { rows } = await q(FOLLOW_LIST('followers'), [req.member.id, req.params.id]);
  res.json({ members: rows.map(shapeFollow) });
});

/** Who this member follows — the tap on the Following number. */
socialRouter.get('/members/:id/following', requireMember, async (req, res) => {
  const { rows } = await q(FOLLOW_LIST('following'), [req.member.id, req.params.id]);
  res.json({ members: rows.map(shapeFollow) });
});

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

  /* Ring the other side's doorbell — their badge and open chat update now,
     not on the next poll. */
  const other = await q(
    `SELECT CASE WHEN member_a = $2 THEN member_b ELSE member_a END AS other
       FROM threads WHERE id = $1`, [req.params.id, req.member.id]);
  if (other.rows[0]) notify([other.rows[0].other], { type: 'dm', thread: req.params.id, from: req.member.id });

  res.status(201).json({ id: rows[0].id, me: true, text: body, at: rows[0].created_at });
});
