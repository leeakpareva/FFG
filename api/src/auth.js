/**
 * Clerk session verification.
 *
 * Every route that touches member data goes through requireMember. The app
 * previously had no server-side auth at all — a signed-out caller could hit
 * any endpoint directly — so this is the enforcement point, not the UI.
 */
import { createClerkClient, verifyToken } from '@clerk/backend';
import { pool } from './db.js';

const secretKey = process.env.CLERK_SECRET_KEY;
const clerk = secretKey ? createClerkClient({ secretKey }) : null;

function bearer(req) {
  const h = req.headers.authorization || '';
  return h.startsWith('Bearer ') ? h.slice(7) : null;
}

/**
 * Resolves the Clerk user to a row in `members`. The app's member ids are
 * initials ("LA"), so first sign-in claims a row by email; after that the
 * clerk_id link is authoritative.
 */
async function resolveMember(claims) {
  const clerkId = claims.sub;
  const linked = await pool.query('SELECT * FROM members WHERE clerk_id = $1', [clerkId]);
  if (linked.rows[0]) return linked.rows[0];

  let email = null;
  if (clerk) {
    try {
      const u = await clerk.users.getUser(clerkId);
      email = u.primaryEmailAddress?.emailAddress?.toLowerCase() || null;
    } catch { /* fall through — unlinked caller */ }
  }
  if (!email) return null;

  const claimed = await pool.query(
    `UPDATE members SET clerk_id = $1, updated_at = now()
       WHERE lower(email) = $2 AND clerk_id IS NULL
     RETURNING *`,
    [clerkId, email]
  );
  return claimed.rows[0] || null;
}

export async function requireMember(req, res, next) {
  if (!secretKey) {
    return res.status(503).json({ error: 'auth not configured' });
  }
  const token = bearer(req);
  if (!token) return res.status(401).json({ error: 'missing token' });

  let claims;
  try {
    claims = await verifyToken(token, { secretKey });
  } catch {
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
