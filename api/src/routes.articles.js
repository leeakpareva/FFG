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
  const paras = await q(
    'SELECT body FROM article_paragraphs WHERE article_id = $1 ORDER BY ord',
    [req.params.id]
  );
  track(req.member.id, 'article_read', { article: req.params.id });
  res.json({ ...rows[0], body: paras.rows.map(p => p.body) });
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
