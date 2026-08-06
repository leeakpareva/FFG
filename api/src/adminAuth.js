/**
 * Super-admin authentication.
 *
 * Deliberately NOT Clerk. The admin panel is Lee's back office: if Clerk is
 * down, misconfigured, or an account is compromised, the ability to run the
 * club must not go with it. One username, one bcrypt-hashed password, both
 * from the environment — never the database, so a SQL-level compromise cannot
 * mint an admin.
 *
 * The login answer is the same for a wrong username and a wrong password:
 * an attacker learns nothing about which half they got right.
 */
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const USER = process.env.ADMIN_USER;
const HASH = process.env.ADMIN_PASSWORD_HASH;
const SECRET = process.env.ADMIN_JWT_SECRET;

const TOKEN_TTL = '12h';

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
  if (!USER || !HASH || !SECRET) {
    return res.status(503).json({ error: 'admin auth not configured' });
  }

  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || 'unknown';
  if (tooMany(ip)) {
    return res.status(429).json({ error: 'too many attempts, try again later' });
  }

  const { username, password } = req.body || {};
  const userOk = typeof username === 'string' && username === USER;
  // Compare even when the username is wrong so both paths cost the same.
  const passOk = typeof password === 'string' && await bcrypt.compare(password, HASH);

  if (!userOk || !passOk) {
    recordFail(ip);
    return res.status(401).json({ error: 'invalid credentials' });
  }

  fails.delete(ip);
  const token = jwt.sign({ role: 'superadmin', sub: username }, SECRET, { expiresIn: TOKEN_TTL });
  res.json({ token, expiresIn: TOKEN_TTL });
});

export function requireSuperAdmin(req, res, next) {
  if (!SECRET) return res.status(503).json({ error: 'admin auth not configured' });
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'missing token' });
  try {
    const claims = jwt.verify(token, SECRET);
    if (claims.role !== 'superadmin') throw new Error('wrong role');
    req.admin = { username: claims.sub || 'admin' };
  } catch {
    return res.status(401).json({ error: 'invalid token' });
  }
  next();
}
