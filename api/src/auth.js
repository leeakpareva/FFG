/**
 * Clerk session verification.
 *
 * Every route that touches member data goes through requireMember. The app
 * previously had no server-side auth at all — a signed-out caller could hit
 * any endpoint directly — so this is the enforcement point, not the UI.
 */
import { createClerkClient, verifyToken } from '@clerk/backend';
import { pool } from './db.js';
import { track } from './track.js';
import { embedMember } from './embed.js';

const secretKey = process.env.CLERK_SECRET_KEY;
const clerk = secretKey ? createClerkClient({ secretKey }) : null;

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/** Strips a string down to what a handle or an id is allowed to contain. */
const slug = (s, fallback) => {
  const out = String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  return out || fallback;
};

/** Initials for the avatar: "Ayesha Taylor-Camara" -> "AT". */
function initialsFor(first, last, email) {
  const a = (first || '').trim();
  const b = (last || '').trim();
  if (a && b) return (a[0] + b[0]).toUpperCase();
  const source = a || b || String(email || '').split('@')[0];
  return (source.slice(0, 2) || 'ME').toUpperCase();
}

/**
 * Creates the member row for a Clerk account that has never signed in.
 *
 * Registration is open: anyone who can sign in becomes a member. New members
 * are never admins — `is_admin` is not settable from anywhere a member can
 * reach, so promotion stays a deliberate database action.
 *
 * id and handle both have to be unique, and two people signing up at once can
 * collide, so a taken value is retried with a numeric suffix rather than
 * failing the request.
 */
async function createMember(clerkId, email, user) {
  const first = user?.firstName || '';
  const last = user?.lastName || '';
  const name = [first, last].filter(Boolean).join(' ') || email.split('@')[0];
  const baseId = initialsFor(first, last, email);
  const baseHandle = slug(`${first}${last}` || email.split('@')[0], 'member').slice(0, 24);

  for (let attempt = 0; attempt < 12; attempt++) {
    const suffix = attempt ? String(attempt + 1) : '';
    try {
      const { rows } = await pool.query(
        `INSERT INTO members (id, clerk_id, name, handle, role, pillar, email, is_admin)
         VALUES ($1,$2,$3,$4,'Member','Community',$5,false)
         RETURNING *`,
        [baseId + suffix, clerkId, name, baseHandle + suffix, email]
      );
      track(rows[0].id, 'member_created', { email });
      embedMember(rows[0]); // async — suggestions learn who they are
      return rows[0];
    } catch (e) {
      if (e.code !== '23505') throw e;
      // Someone else took the id or handle. If the clash is on clerk_id the
      // account was created by a concurrent request — use theirs.
      if (e.constraint === 'members_clerk_id_key') {
        const { rows } = await pool.query('SELECT * FROM members WHERE clerk_id = $1', [clerkId]);
        if (rows[0]) return rows[0];
      }
    }
  }
  return null;
}

/**
 * Resolves the Clerk user to a row in `members`.
 *
 * Three ways to land on a row, in order: an existing clerk_id link (the
 * authoritative one), an invited row waiting on a matching email, or a fresh
 * row created on the spot.
 */
async function resolveMember(claims) {
  const clerkId = claims.sub;
  const linked = await pool.query('SELECT * FROM members WHERE clerk_id = $1', [clerkId]);
  if (linked.rows[0]) return linked.rows[0];

  let user = null;
  if (clerk) {
    try {
      user = await clerk.users.getUser(clerkId);
    } catch { /* fall through — we cannot identify this caller */ }
  }
  const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase() || null;
  if (!email) return null;

  const claimed = await pool.query(
    `UPDATE members SET clerk_id = $1, updated_at = now()
       WHERE lower(email) = $2 AND clerk_id IS NULL
     RETURNING *`,
    [clerkId, email]
  );
  if (claimed.rows[0]) return claimed.rows[0];

  return createMember(clerkId, email, user);
}

export async function requireMember(req, res, next) {
  if (!secretKey) {
    return res.status(503).json({ error: 'auth not configured' });
  }
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'missing token' });

  let claims;
  try {
    // Clerk's default tolerance is 5s. The ASUS host drifted 12s once and
    // every token was rejected as "issued in the future" — a dead app for a
    // clock problem. 60s absorbs ordinary drift without meaningfully
    // widening the window a stolen token stays usable.
    claims = await verifyToken(token, { secretKey, clockSkewInMs: 60_000 });
  } catch (e) {
    // Logged, never returned: the reason is a debugging aid for us, not
    // something to hand an unauthenticated caller.
    console.error('[auth] token rejected:', e.reason || e.message);
    return res.status(401).json({ error: 'invalid token' });
  }

  const member = await resolveMember(claims);
  if (!member) {
    // Signed in with Clerk but no FFG membership behind it.
    return res.status(403).json({ error: 'not a member' });
  }

  req.member = member;
  next();
}

/** Articles are editorial: only admins may publish. */
export function requireAdmin(req, res, next) {
  if (!req.member?.is_admin) {
    return res.status(403).json({ error: 'admin only' });
  }
  next();
}
