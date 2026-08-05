/**
 * A member's own profile.
 *
 * Every member may edit their own row and no one else's — the id always comes
 * from the verified token via requireMember, never from the request body, so
 * there is no object to tamper with. `is_admin` and `verified` are deliberately
 * not editable here: a member could otherwise promote themselves.
 */
import { Router } from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { trackActive } from './track.js';
import { embedMember } from './embed.js';

export const profileRouter = Router();

const PILLARS = ['Capital', 'Community', 'Connect'];

/** Handles appear in URLs and @-mentions, so keep the character set boring. */
const HANDLE_RE = /^[a-z0-9][a-z0-9._-]{1,29}$/;

const LIMITS = { name: 60, role: 80, bio: 400 };

/** Shape returned to the client. Selected in one place so GET and PATCH agree. */
const SELECT_ME = `
  SELECT m.id, m.name, m.handle, m.role, m.pillar, m.bio, m.verified,
         m.is_admin, m.avatar_media_id, av.storage_key AS avatar_key,
         (SELECT count(*)::int FROM posts p WHERE p.member_id = m.id)        AS posts_count,
         (SELECT count(*)::int FROM follows f WHERE f.followee_id = m.id)    AS followers,
         (SELECT count(*)::int FROM follows f WHERE f.follower_id = m.id)    AS following
    FROM members m
    LEFT JOIN media av ON av.id = m.avatar_media_id
   WHERE m.id = $1`;

const shape = (r) => ({
  id: r.id,
  name: r.name,
  handle: r.handle,
  role: r.role,
  pillar: r.pillar,
  bio: r.bio,
  verified: r.verified,
  is_admin: r.is_admin,
  posts: r.posts_count,
  followers: r.followers,
  following: r.following,
  avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null,
});

profileRouter.get('/', requireMember, async (req, res) => {
  trackActive(req.member.id); // every app open lands here — this powers DAU
  const { rows } = await q(SELECT_ME, [req.member.id]);
  res.json(shape(rows[0]));
});

/**
 * Partial update: only the keys present in the body are touched, so the client
 * can save one field without having to send back a whole profile it might be
 * holding a stale copy of.
 */
profileRouter.patch('/', requireMember, async (req, res) => {
  const body = req.body || {};
  const sets = [];
  const vals = [];
  const put = (col, val) => { vals.push(val); sets.push(`${col} = $${vals.length}`); };

  const text = (key, col, { required = true } = {}) => {
    if (!(key in body)) return null;
    const v = typeof body[key] === 'string' ? body[key].trim() : '';
    if (!v && required) return `${key} cannot be empty`;
    if (v.length > LIMITS[key]) return `${key} must be ${LIMITS[key]} characters or fewer`;
    put(col, v || null);
    return null;
  };

  for (const err of [text('name', 'name'), text('role', 'role'),
                     text('bio', 'bio', { required: false })]) {
    if (err) return res.status(400).json({ error: err });
  }

  if ('handle' in body) {
    const h = String(body.handle || '').trim().toLowerCase();
    if (!HANDLE_RE.test(h)) {
      return res.status(400).json({
        error: 'invalid handle',
        detail: 'Use 2-30 characters: lowercase letters, numbers, dots, dashes or underscores.',
      });
    }
    put('handle', h);
  }

  if ('pillar' in body) {
    if (!PILLARS.includes(body.pillar)) {
      return res.status(400).json({ error: 'pillar must be Capital, Community or Connect' });
    }
    put('pillar', body.pillar);
  }

  if ('avatar_media_id' in body) {
    const id = body.avatar_media_id;
    if (id === null) {
      put('avatar_media_id', null);
    } else {
      // Must be a real, finished upload that this member owns — otherwise a
      // member could point their avatar at someone else's file.
      const { rows } = await q(
        'SELECT id FROM media WHERE id = $1 AND owner_id = $2 AND uploaded',
        [id, req.member.id]
      );
      if (!rows[0]) return res.status(400).json({ error: 'unknown avatar image' });
      put('avatar_media_id', id);
    }
  }

  if (!sets.length) return res.status(400).json({ error: 'nothing to update' });

  vals.push(req.member.id);
  try {
    await q(
      `UPDATE members SET ${sets.join(', ')}, updated_at = now() WHERE id = $${vals.length}`,
      vals
    );
  } catch (e) {
    if (e.code === '23505') return res.status(409).json({ error: 'that handle is already taken' });
    console.error('[profile]', e.message);
    return res.status(500).json({ error: 'could not save profile' });
  }

  const { rows } = await q(SELECT_ME, [req.member.id]);
  embedMember(rows[0]); // async — who they are just changed, so re-learn it
  res.json(shape(rows[0]));
});
