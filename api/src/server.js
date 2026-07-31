import express from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { mediaRouter, mediaFileRouter } from './routes.media.js';
import { articlesRouter } from './routes.articles.js';

const app = express();
app.disable('x-powered-by');

/**
 * CORS.
 *
 * The API is reachable publicly (through the Cloudflare tunnel) so the
 * Vercel-hosted frontend can call it. Origins are an explicit allowlist from
 * ALLOWED_ORIGINS — never a wildcard, and never reflected blindly.
 *
 * Auth travels as an Authorization header rather than a cookie, so
 * Access-Control-Allow-Credentials stays off: a hostile page cannot ride a
 * member's session just by being in their browser.
 */
const allowedOrigins = new Set(
  (process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean)
);

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.set('Access-Control-Allow-Origin', origin);
    res.set('Vary', 'Origin');
    res.set('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.set('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    // Unknown origin gets no CORS headers, so the browser blocks it anyway.
    return res.status(origin && allowedOrigins.has(origin) ? 204 : 403).end();
  }
  next();
});

app.use(express.json({ limit: '256kb' }));

// Health is deliberately unauthenticated so the container healthcheck and
// uptime monitor can reach it.
app.get('/api/health', async (_req, res) => {
  try {
    await q('SELECT 1');
    res.json({ ok: true, db: 'up' });
  } catch (e) {
    res.status(503).json({ ok: false, db: 'down', error: e.message });
  }
});

// Who am I — lets the client know whether to show admin surfaces.
app.get('/api/me', requireMember, (req, res) => {
  const m = req.member;
  res.json({ id: m.id, name: m.name, handle: m.handle, is_admin: m.is_admin });
});

app.use('/api/media', mediaRouter);
app.use('/api/articles', articlesRouter);
app.use('/media', mediaFileRouter);

app.use((req, res) => res.status(404).json({ error: 'not found' }));

// Never leak a stack trace to the client.
app.use((err, _req, res, _next) => {
  console.error('[api]', err);
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 8110;
app.listen(port, '0.0.0.0', () => console.log(`[api] listening on ${port}`));
