/**
 * Web push and event reminders.
 *
 * Push is a doorbell for closed apps, the same philosophy as the WebSocket:
 * a small payload, and the app refetches when opened. Subscriptions are one
 * row per browser (the endpoint is the identity); dead endpoints are pruned
 * the first time a push bounces 404/410.
 *
 * The reminder job runs on an interval: any seat for an event starting in
 * roughly a day that has not been reminded gets one email (and a push where
 * subscribed). reminded_at is claimed atomically per seat, so restarts and
 * overlapping ticks cannot double-send.
 *
 * Env: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:). With
 * no keys, everything here degrades to a no-op and the app works as before.
 */
import { Router } from 'express';
import webpush from 'web-push';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { sendMail, ffgEmail, emailButton, escapeHtml, APP_BASE } from './mailer.js';

const PUB = process.env.VAPID_PUBLIC_KEY;
const PRIV = process.env.VAPID_PRIVATE_KEY;
export const pushReady = !!(PUB && PRIV);
if (pushReady) {
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:lee@navada.info', PUB, PRIV);
}

/** Send to every browser a member has subscribed. Fire-and-forget. */
export async function pushToMember(memberId, payload) {
  if (!pushReady) return;
  let rows;
  try {
    ({ rows } = await q('SELECT endpoint, keys FROM push_subscriptions WHERE member_id = $1', [memberId]));
  } catch { return; } // table missing on an un-migrated box: silently off
  const body = JSON.stringify(payload);
  for (const row of rows) {
    try {
      await webpush.sendNotification({ endpoint: row.endpoint, keys: row.keys }, body);
    } catch (e) {
      if (e.statusCode === 404 || e.statusCode === 410) {
        q('DELETE FROM push_subscriptions WHERE endpoint = $1', [row.endpoint]).catch(() => {});
      }
    }
  }
}

export const pushRouter = Router();

/* The browser needs the public key to subscribe. Not a secret. */
pushRouter.get('/key', requireMember, (_req, res) => {
  if (!pushReady) return res.status(503).json({ error: 'push not configured' });
  res.json({ key: PUB });
});

pushRouter.post('/subscribe', requireMember, async (req, res) => {
  const sub = req.body?.subscription;
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return res.status(400).json({ error: 'a browser push subscription is required' });
  }
  await q(
    `INSERT INTO push_subscriptions (endpoint, member_id, keys)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET member_id = $2, keys = $3`,
    [String(sub.endpoint).slice(0, 1000), req.member.id, JSON.stringify(sub.keys)]
  );
  res.status(201).json({ ok: true });
});

pushRouter.delete('/subscribe', requireMember, async (req, res) => {
  const endpoint = req.body?.endpoint;
  if (endpoint) {
    await q('DELETE FROM push_subscriptions WHERE endpoint = $1 AND member_id = $2',
      [String(endpoint).slice(0, 1000), req.member.id]);
  }
  res.status(204).end();
});

/* ------------------------------------------------------------- reminders */

const REMINDER_TICK_MS = 15 * 60 * 1000;

async function remindTick() {
  let rows;
  try {
    ({ rows } = await q(`
      SELECT a.event_id, a.member_id, e.name, e.starts_at, e.venue, e.time_label,
             m.email, m.name AS member_name
        FROM event_attendees a
        JOIN events e ON e.id = a.event_id
        JOIN members m ON m.id = a.member_id
       WHERE a.reminded_at IS NULL
         AND e.starts_at IS NOT NULL
         AND e.starts_at BETWEEN now() + interval '20 hours' AND now() + interval '28 hours'`));
  } catch { return; } // un-migrated box

  for (const r of rows) {
    // Claim the seat first — exactly-once whatever restarts or overlaps.
    const claimed = await q(
      `UPDATE event_attendees SET reminded_at = now()
        WHERE event_id = $1 AND member_id = $2 AND reminded_at IS NULL RETURNING 1`,
      [r.event_id, r.member_id]);
    if (!claimed.rows[0] || !r.email) continue;

    const when = new Date(r.starts_at).toLocaleString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      timeZone: 'Europe/London',
    });
    sendMail({
      to: r.email,
      subject: `Tomorrow: ${r.name}`,
      html: ffgEmail(`
        <p style="margin:0 0 6px;text-align:center;font-size:10px;letter-spacing:3px;color:#8A867C;">EVENT REMINDER</p>
        <h1 style="margin:6px 0 18px;text-align:center;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.2;color:#17171B;">
          ${escapeHtml(r.name)}
        </h1>
        <p style="margin:0 0 14px;">Dear ${escapeHtml((r.member_name || '').split(' ')[0] || 'member')},</p>
        <p style="margin:0 0 14px;">A reminder that you have a seat tomorrow:</p>
        <p style="margin:0 0 14px;"><strong>${escapeHtml(when)}</strong>${r.venue ? `<br/>${escapeHtml(r.venue)}` : ''}</p>
        ${emailButton(APP_BASE, 'Open FFG Connect')}
        <p style="margin:0;color:#8A867C;font-size:13px;text-align:center;">Your ticket is in the app, under the event.</p>
      `),
    });
    pushToMember(r.member_id, {
      type: 'event_reminder',
      title: 'Tomorrow: ' + r.name,
      body: [when, r.venue].filter(Boolean).join(' · '),
    }).catch(() => {});
  }
}

export function startEventReminders() {
  setInterval(() => remindTick().catch(e => console.error('[reminders]', e.message)), REMINDER_TICK_MS);
  remindTick().catch(e => console.error('[reminders]', e.message));
}
