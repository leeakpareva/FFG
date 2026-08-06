/**
 * Admin authentication.
 *
 * Two kinds of account share one login form:
 *
 *   superadmin — ONE username/password pair from the environment, never the
 *   database. This is Lee's break-glass credential: if Clerk is down, if
 *   Postgres is compromised, the ability to run the club must survive.
 *   A SQL-level compromise cannot mint or alter this account.
 *
 *   team — named accounts (Ann, Charlene, …) in the admin_users table with
 *   an array of scopes ('website', 'marketing', 'applications'). Their edits
 *   carry their name; their access is granted per area from the Team screen.
 *
 * The login answer is the same for a wrong username and a wrong password:
 * an attacker learns nothing about which half they got right.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { q } from './db.js';

const USER = process.env.ADMIN_USER;
const HASH = process.env.ADMIN_PASSWORD_HASH;
const SECRET = process.env.ADMIN_JWT_SECRET;

const TOKEN_TTL = '12h';

/* A real bcrypt hash of random bytes — compared against when the username
   doesn't exist, so both paths cost the same. */
const DUMMY_HASH = bcrypt.hashSync('nope-' + Math.random(), 10);

/* Five failed tries per IP, then a 15-minute door. In-memory is fine: one
   process, and a restart clearing the slate is acceptable. */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;
const fails = new Map(); // ip -> { count, first }

function tooMany(ip) {
  const f = fails.get(ip);
  if (!f) return false;
  if (Date.now() - f.first > WINDOW_MS) { fails.delete(ip); return false; }
  return f.count >= MAX_FAILS;
}

function recordFail(ip) {
  const f = fails.get(ip);
  if (!f || Date.now() - f.first > WINDOW_MS) {
    fails.set(ip, { count: 1, first: Date.now() });
  } else {
    f.count += 1;
  }
}

export const adminLoginRouter = Router();

adminLoginRouter.post('/', async (req, res) => {
  if (!SECRET) {
    return res.status(503).json({ error: 'admin auth not configured' });
  }

  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  if (tooMany(ip)) {
    return res.status(429).json({ error: 'too many attempts, try again later' });
  }

  const { username, password } = req.body || {};
  if (typeof username !== 'string' || typeof password !== 'string') {
    recordFail(ip);
    return res.status(401).json({ error: 'invalid credentials' });
  }

  // Superadmin first: env-only, exactly as it has always been.
  if (USER && HASH && username === USER) {
    const ok = await bcrypt.compare(password, HASH);
    if (!ok) {
      recordFail(ip);
      return res.status(401).json({ error: 'invalid credentials' });
    }
    fails.delete(ip);
    const token = jwt.sign(
      { role: 'superadmin', sub: username, name: 'Admin', scopes: ['*'] },
      SECRET, { expiresIn: TOKEN_TTL },
    );
    return res.json({ token, expiresIn: TOKEN_TTL, name: 'Admin', role: 'superadmin', scopes: ['*'] });
  }

  // Team accounts: named, scoped, in the database.
  let row = null;
  try {
    const r = await q(
      'SELECT username, display_name, password_hash, scopes, disabled FROM admin_users WHERE username = $1',
      [username.toLowerCase()],
    );
    row = r.rows[0] || null;
  } catch {
    /* table may not exist yet on an un-migrated box; treat as no user */
  }

  const passOk = await bcrypt.compare(password, row?.password_hash || DUMMY_HASH);
  if (!row || row.disabled || !passOk) {
    recordFail(ip);
    return res.status(401).json({ error: 'invalid credentials' });
  }

  fails.delete(ip);
  q('UPDATE admin_users SET last_login_at = now() WHERE username = $1', [row.username]).catch(() => {});
  const token = jwt.sign(
    { role: 'admin', sub: row.username, name: row.display_name, scopes: row.scopes || [] },
    SECRET, { expiresIn: TOKEN_TTL },
  );
  res.json({ token, expiresIn: TOKEN_TTL, name: row.display_name, role: 'admin', scopes: row.scopes || [] });
});

function readClaims(req) {
  if (!SECRET) return null;
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return null;
  try {
    return jwt.verify(token, SECRET);
  } catch {
    return null;
  }
}

function attach(req, claims) {
  req.admin = {
    username: claims.sub || 'admin',
    name: claims.name || claims.sub || 'admin',
    role: claims.role,
    scopes: claims.role === 'superadmin' ? ['*'] : (claims.scopes || []),
  };
}

/** Any signed-in admin — superadmin or a team account. */
export function requireAdmin(req, res, next) {
  if (!SECRET) return res.status(503).json({ error: 'admin auth not configured' });
  const claims = readClaims(req);
  if (!claims || (claims.role !== 'superadmin' && claims.role !== 'admin')) {
    return res.status(401).json({ error: 'invalid token' });
  }
  attach(req, claims);
  next();
}

/** Superadmin only — the env credential. */
export function requireSuperAdmin(req, res, next) {
  if (!SECRET) return res.status(503).json({ error: 'admin auth not configured' });
  const claims = readClaims(req);
  if (!claims || claims.role !== 'superadmin') {
    return res.status(401).json({ error: 'invalid token' });
  }
  attach(req, claims);
  next();
}

/** True when the (already attached) admin holds a scope. */
export function hasScope(req, scope) {
  const scopes = req.admin?.scopes || [];
  return scopes.includes('*') || scopes.includes(scope);
}
