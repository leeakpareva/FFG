/**
 * The public face of the API: what the FFG website needs and nothing more.
 *
 *   POST /api/apply         the membership application form
 *   GET  /api/site-content  the CMS slots the website renders from
 *
 * No auth on either — the website's visitors are strangers by definition.
 * The apply route defends itself: rate limit per IP, a honeypot field, and
 * hard caps on every input.
 */
import { Router } from 'express';
import { q } from './db.js';
import { sendMail, ffgEmail, emailButton, escapeHtml, applyNotify, APP_BASE } from './mailer.js';

export const publicRouter = Router();

/* ------------------------------------------------------------ rate limit */

/** ip -> [epoch ms of recent applications] */
const recent = new Map();
const WINDOW_MS = 3600_000;
const MAX_PER_WINDOW = 5;

setInterval(() => {
  const cutoff = Date.now() - WINDOW_MS;
  for (const [ip, times] of recent) {
    const keep = times.filter(t => t > cutoff);
    if (keep.length) recent.set(ip, keep); else recent.delete(ip);
  }
}, 600_000).unref();

function limited(ip) {
  const times = (recent.get(ip) || []).filter(t => t > Date.now() - WINDOW_MS);
  if (times.length >= MAX_PER_WINDOW) return true;
  times.push(Date.now());
  recent.set(ip, times);
  return false;
}

/* ----------------------------------------------------------------- apply */

publicRouter.post('/apply', async (req, res) => {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '?';
  const { name, email, phone, about, referral, company } = req.body || {};

  // Honeypot: no human ever fills "company" (it is invisible). Answer as if
  // it worked so the bot learns nothing.
  if (company) return res.status(201).json({ ok: true });

  if (limited(ip)) return res.status(429).json({ error: 'Too many applications from this connection — try again later.' });

  const cleanName = String(name || '').trim().slice(0, 120);
  const cleanEmail = String(email || '').trim().toLowerCase().slice(0, 200);
  if (!cleanName || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
    return res.status(400).json({ error: 'A name and a valid email address are required.' });
  }

  let application;
  try {
    const { rows } = await q(
      `INSERT INTO applications (name, email, phone, about, referral)
       VALUES ($1,$2,$3,$4,$5) RETURNING id, created_at`,
      [
        cleanName,
        cleanEmail,
        String(phone || '').trim().slice(0, 40) || null,
        String(about || '').trim().slice(0, 2000) || null,
        String(referral || '').trim().slice(0, 24) || null,
      ]
    );
    application = rows[0];
  } catch (e) {
    if (e.code === '23505') {
      // Already a pending application for this email — that is a success
      // from the applicant's point of view, not an error to bounce off.
      return res.status(201).json({ ok: true });
    }
    throw e;
  }

  // Referral attribution, resolved for the notification.
  let referredBy = null;
  if (referral) {
    const ref = await q('SELECT name FROM members WHERE id = $1', [String(referral).trim()]);
    referredBy = ref.rows[0]?.name || null;
  }

  const reviewers = applyNotify();
  if (reviewers.length) {
    const rows = [
      ['Name', cleanName],
      ['Email', cleanEmail],
      ['Phone', String(phone || '').trim() || '—'],
      ['Referred by', referredBy ? `${referredBy} (${escapeHtml(referral)})` : '—'],
    ].map(([k, v]) => `
      <tr>
        <td style="padding:6px 14px 6px 0;color:#8A867C;font-size:13px;white-space:nowrap;vertical-align:top;">${k}</td>
        <td style="padding:6px 0;font-size:14px;">${escapeHtml(v)}</td>
      </tr>`).join('');
    sendMail({
      to: reviewers.join(', '),
      cc: 'lee@navada.info',
      subject: `New membership application: ${cleanName}`,
      html: ffgEmail(`
        <p style="margin:0 0 14px;">A new application just arrived for Connect.</p>
        <table cellpadding="0" cellspacing="0" style="margin:6px 0 2px;">${rows}</table>
        ${about ? `<p style="margin:14px 0 4px;color:#8A867C;font-size:13px;">In their words</p><p style="margin:0 0 8px;">${escapeHtml(String(about).slice(0, 2000))}</p>` : ''}
        ${emailButton(`${APP_BASE}/admin`, 'Review in the admin panel')}
        <p style="margin:0;color:#8A867C;font-size:13px;">Approve and they get their welcome email and access automatically; reject and they are let down gently.</p>
      `),
    });
  }

  res.status(201).json({ ok: true, id: application.id });
});

/* ---------------------------------------------------------- site content */

publicRouter.get('/site-content', async (_req, res) => {
  const { rows } = await q('SELECT key, value FROM site_content');
  const content = {};
  for (const row of rows) content[row.key] = row.value;
  // The website polls this on every visit; let the tunnel's edge absorb it.
  res.set('Cache-Control', 'public, max-age=30');
  res.json({ content });
});
