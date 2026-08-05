/**
 * The member directory.
 *
 * This is what makes the Meet tab real: the app used to render a hardcoded
 * cast of sample people, and this endpoint replaces them with the actual
 * members table. Members only — the directory of a private club is itself
 * private.
 *
 * The shape deliberately matches what the profile screens already expect
 * (see routes.profile.js), plus empty highlights/tiles arrays: those are
 * profile decorations members will curate later, and an empty array is the
 * honest value until they do.
 */
import { Router } from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';

export const membersRouter = Router();

membersRouter.get('/', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT m.id, m.name, m.handle, m.role, m.pillar, m.bio, m.verified, m.is_org,
           av.storage_key AS avatar_key,
           (SELECT count(*)::int FROM posts p WHERE p.member_id = m.id)     AS posts_count,
           (SELECT count(*)::int FROM follows f WHERE f.followee_id = m.id) AS followers,
           (SELECT count(*)::int FROM follows f WHERE f.follower_id = m.id) AS following,
           EXISTS (SELECT 1 FROM follows f
                    WHERE f.follower_id = $1 AND f.followee_id = m.id)      AS followed_by_me,
           /* Interest affinity: how close their vector sits to yours.
              This is what orders "people you should know". */
           CASE WHEN m.embedding IS NOT NULL AND me.embedding IS NOT NULL
                THEN 1 - (m.embedding <=> me.embedding) END                 AS affinity
      FROM members m
      JOIN members me ON me.id = $1
      LEFT JOIN media av ON av.id = m.avatar_media_id
     ORDER BY m.name
  `, [req.member.id]);

  res.json({
    members: rows.map((r) => ({
      id: r.id,
      name: r.name,
      handle: r.handle,
      role: r.role || '',
      pillar: r.pillar || 'Community',
      bio: r.bio || '',
      verified: r.verified,
      is_org: r.is_org,
      posts: r.posts_count,
      followers: r.followers,
      following: r.following,
      avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null,
      followed_by_me: r.followed_by_me,
      affinity: r.affinity != null ? Number(r.affinity) : null,
      highlights: [],
      tiles: [],
    })),
  });
});
