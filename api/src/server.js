import express from 'express';
import { q } from './db.js';
import { mediaRouter, mediaFileRouter } from './routes.media.js';
import { articlesRouter } from './routes.articles.js';
import { profileRouter } from './routes.profile.js';
import { roomsRouter } from './routes.rooms.js';
import { conciergeRouter } from './routes.concierge.js';
import { membersRouter } from './routes.members.js';
import { contentRouter } from './routes.content.js';
import { socialRouter } from './routes.social.js';
import { adminLoginRouter } from './adminAuth.js';
import { adminRouter } from './routes.admin.js';
import { stripeWebhookRouter } from './stripe.js';
import { setupWs } from './ws.js';
import { catchAsync } from './catchAsync.js';

const app = express();
app.disable('x-powered-by');

/**
 * Express 4 does not catch a rejected promise from an async handler, so it
 * escapes as an unhandled rejection and Node kills the process. One bad
 * request took the whole API down that way. These two turn that into a 500
 * and a log line: a request failing must never be able to end the service.
 *
 * The routers stay plain async functions; this is the net under them.
 */
process.on('unhandledRejection', (e) => {
  console.error('[api] unhandled rejection:', e?.stack || e);
});
process.on('uncaughtException', (e) => {
  console.error('[api] uncaught exception:', e?.stack || e);
});

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
    res.set('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Authorization,Content-Type');
    res.set('Access-Control-Max-Age', '86400');
  }
  if (req.method === 'OPTIONS') {
    // Unknown origin gets no CORS headers, so the browser blocks it anyway.
    return res.status(origin && allowedOrigins.has(origin) ? 204 : 403).end();
  }
  next();
});

// Stripe's webhook signature covers the raw bytes, so this router (which
// carries its own express.raw) must be mounted before the JSON parser eats
// the body.
app.use('/api/stripe/webhook', catchAsync(stripeWebhookRouter));

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

// Who am I, and my own profile: GET to read, PATCH to edit.
app.use('/api/me', catchAsync(profileRouter));

app.use('/api/media', catchAsync(mediaRouter));
app.use('/api/articles', catchAsync(articlesRouter));
app.use('/api/rooms', catchAsync(roomsRouter));
app.use('/api/concierge', catchAsync(conciergeRouter));
app.use('/api/members', catchAsync(membersRouter));
app.use('/api', catchAsync(contentRouter));       // /api/events, /api/replays, /api/workshops
app.use('/api', catchAsync(socialRouter));        // /api/posts, /api/threads, follows

// The back office: its own login, its own tokens, nothing shared with Clerk.
app.use('/api/admin/login', catchAsync(adminLoginRouter));
app.use('/api/admin', catchAsync(adminRouter));

app.use('/media', catchAsync(mediaFileRouter));

app.use((req, res) => res.status(404).json({ error: 'not found' }));

// Never leak a stack trace to the client. Errors that already carry a 4xx —
// a malformed JSON body from body-parser, say — keep it: that is the caller's
// mistake to fix, and reporting it as 500 sends them hunting our bug instead.
app.use((err, _req, res, _next) => {
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({ error: 'bad request' });
  }
  console.error('[api]', err);
  res.status(500).json({ error: 'internal error' });
});

const port = process.env.PORT || 8110;
const server = app.listen(port, '0.0.0.0', () => console.log(`[api] listening on ${port}`));

// Real-time doorbell: /ws, same Clerk auth as REST.
setupWs(server);
