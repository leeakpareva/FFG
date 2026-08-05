/**
 * Library / articles.
 *
 * Reading is open to any signed-in member. Writing is admin-only and
 * enforced here — the client also hides the compose UI, but that is a
 * convenience, not the control.
 */
import { Router } from 'express';
import { q, pool } from './db.js';
import { requireMember, requireAdmin } from './auth.js';
import { track } from './track.js';

export const articlesRouter = Router();

articlesRouter.get('/', requireMember, async (_req, res) => {
  const { rows } = await q(
    `SELECT a.id, a.title, a.excerpt, a.tag, a.author_id, a.read_time,
            a.image_key, a.published_label, a.published_at,
            m.storage_key AS media_key
       FROM articles a
       LEFT JOIN media m ON m.id = a.media_id
      WHERE NOT a.is_draft
      ORDER BY a.published_at DESC NULLS LAST, a.created_at DESC`
  );
  res.json(rows.map(r => ({ ...r, image_url: r.media_key ? `/media/${r.media_key}` : null })));
});

articlesRouter.get('/:id', requireMember, async (req, res) => {
  const { rows } = await q('SELECT * FROM articles WHERE id = $1 AND NOT is_draft', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  const [paras, engagement] = await Promise.all([
    q('SELECT body FROM article_paragraphs WHERE article_id = $1 ORDER BY ord', [req.params.id]),
    q(`SELECT
         (SELECT count(*)::int FROM article_likes al WHERE al.article_id = $1) AS likes,
         EXISTS (SELECT 1 FROM article_likes al WHERE al.article_id = $1 AND al.member_id = $2) AS liked,
         (SELECT count(*)::int FROM article_comments ac WHERE ac.article_id = $1) AS comments`,
      [req.params.id, req.member.id]),
  ]);
  track(req.member.id, 'article_read', { article: req.params.id });
  res.json({ ...rows[0], body: paras.rows.map(p => p.body), ...engagement.rows[0] });
});

/** Like toggle — same contract as posts. */
articlesRouter.post('/:id/like', requireMember, async (req, res) => {
  const del = await q('DELETE FROM article_likes WHERE article_id = $1 AND member_id = $2',
    [req.params.id, req.member.id]);
  if (!del.rowCount) {
    try {
      await q('INSERT INTO article_likes (article_id, member_id) VALUES ($1, $2)', [req.params.id, req.member.id]);
    } catch (e) {
      if (e.code === '23503') return res.status(404).json({ error: 'no such article' });
      throw e;
    }
  }
  const { rows } = await q('SELECT count(*)::int AS likes FROM article_likes WHERE article_id = $1', [req.params.id]);
  res.json({ likes: rows[0].likes, liked: !del.rowCount });
});

articlesRouter.get('/:id/comments', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT c.id, c.member_id, c.body, c.created_at,
           m.name AS author_name, m.handle AS author_handle,
           av.storage_key AS author_avatar_key
      FROM article_comments c
      JOIN members m ON m.id = c.member_id
      LEFT JOIN media av ON av.id = m.avatar_media_id
     WHERE c.article_id = $1 ORDER BY c.created_at LIMIT 200`, [req.params.id]);
  res.json({
    comments: rows.map(c => ({
      id: c.id, uid: c.member_id, mine: c.member_id === req.member.id,
      author: { name: c.author_name, handle: c.author_handle,
        avatar_url: c.author_avatar_key ? `/media/${c.author_avatar_key}` : null },
      text: c.body, at: c.created_at,
    })),
  });
});

articlesRouter.post('/:id/comments', requireMember, async (req, res) => {
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'body is required' });
  try {
    const { rows } = await q(
      `INSERT INTO article_comments (article_id, member_id, body)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [req.params.id, req.member.id, body.slice(0, 1000)]);
    track(req.member.id, 'comment', { article: req.params.id });
    res.status(201).json({
      id: rows[0].id, uid: req.member.id, mine: true,
      author: { name: req.member.name, handle: req.member.handle, avatar_url: null },
      text: body.slice(0, 1000), at: rows[0].created_at,
    });
  } catch (e) {
    if (e.code === '23503') return res.status(404).json({ error: 'no such article' });
    throw e;
  }
});

/** Your own comment, or admin. */
articlesRouter.delete('/comments/:id', requireMember, async (req, res) => {
  const { rowCount } = await q(
    `DELETE FROM article_comments WHERE id = $1 AND ($2 OR member_id = $3)`,
    [req.params.id, req.member.is_admin, req.member.id]);
  if (!rowCount) return res.status(404).json({ error: 'not found' });
  res.status(204).end();
});

articlesRouter.post('/', requireMember, requireAdmin, async (req, res) => {
  const { id, title, excerpt, tag, body, read_time, media_id, is_draft } = req.body || {};

  if (!id || !title || !Array.isArray(body) || body.length === 0) {
    return res.status(400).json({ error: 'id, title and a non-empty body are required' });
  }
  if (!['Capital', 'Community', 'Connect'].includes(tag)) {
    return res.status(400).json({ error: 'tag must be Capital, Community or Connect' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO articles
         (id, title, excerpt, tag, author_id, read_time, media_id,
          published_by, published_at, is_draft, published_label)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $9 THEN NULL ELSE now() END, $9, 'Today')`,
      [id, title, excerpt || null, tag, req.member.id, read_time || null,
       media_id || null, req.member.id, !!is_draft]
    );
    for (const [i, para] of body.entries()) {
      await client.query(
        'INSERT INTO article_paragraphs (article_id, ord, body) VALUES ($1,$2,$3)',
        [id, i, para]
      );
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    if (e.code === '23505') return res.status(409).json({ error: 'an article with that id already exists' });
    console.error('[articles]', e.message);
    return res.status(500).json({ error: 'could not publish' });
  } finally {
    client.release();
  }

  res.status(201).json({ id });
});

articlesRouter.delete('/:id', requireMember, requireAdmin, async (req, res) => {
  await q('DELETE FROM articles WHERE id = $1', [req.params.id]);
  res.status(204).end();
});
