/**
 * Member-facing reads for the content the admin panel manages: events,
 * replays and workshops. (Articles already have routes.articles.js.)
 *
 * Only published rows leave this file — drafts are an admin concern and a
 * member must not be able to tell they exist. Shapes match what the app's
 * tabs already render, so publishing in admin is all it takes for content
 * to appear.
 */
import { Router } from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { playbackToken, streamReady } from './stream.js';
import { createEventCheckout, stripeReady } from './stripe.js';
import { track } from './track.js';

export const contentRouter = Router();

/* ------------------------------------------------------------------ events */

contentRouter.get('/events', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT e.id, e.name, e.venue, e.day, e.month, e.starts_at, e.time_label,
           e.tag, e.spots, e.host_id, e.image_key, e.about, e.price_pence,
           m.name AS host_name,
           EXISTS (SELECT 1 FROM event_attendees a
                    WHERE a.event_id = e.id AND a.member_id = $1) AS attending,
           EXISTS (SELECT 1 FROM payments p
                    WHERE p.event_id = e.id AND p.member_id = $1
                      AND p.status = 'pending')                    AS payment_pending
      FROM events e
      LEFT JOIN members m ON m.id = e.host_id
     ORDER BY e.starts_at NULLS LAST, e.created_at DESC
  `, [req.member.id]);
  res.json({
    events: rows.map((r) => ({
      ...r,
      image_url: r.image_key ? `/media/${r.image_key}` : null,
    })),
  });
});

/**
 * Who's going, for the event page: real attendees, oldest seat first, capped.
 * Members can see each other by design — this is a members-only club page.
 */
contentRouter.get('/events/:id/attendees', requireMember, async (req, res) => {
  const { rows } = await q(`
    SELECT m.id, m.name, a.rsvp_at
      FROM event_attendees a JOIN members m ON m.id = a.member_id
     WHERE a.event_id = $1
     ORDER BY a.rsvp_at ASC
     LIMIT 24`, [req.params.id]);
  const count = await q('SELECT count(*)::int AS n FROM event_attendees WHERE event_id = $1', [req.params.id]);
  res.json({ attendees: rows, count: count.rows[0].n });
});

/** Free events: attending is one tap. Paid events must go through checkout. */
contentRouter.post('/events/:id/attend', requireMember, async (req, res) => {
  const { rows } = await q('SELECT id, price_pence FROM events WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (rows[0].price_pence) {
    return res.status(402).json({ error: 'this event is paid — use checkout' });
  }
  await q(`INSERT INTO event_attendees (event_id, member_id) VALUES ($1, $2)
           ON CONFLICT DO NOTHING`, [req.params.id, req.member.id]);
  track(req.member.id, 'event_rsvp', { event: req.params.id });
  res.json({ attending: true });
});

/**
 * Paid events: a Checkout Session tied to the event. The webhook granting
 * the seat on completion is what keeps "paid" and "attending" one fact.
 */
contentRouter.post('/events/:id/checkout', requireMember, async (req, res) => {
  const { rows } = await q('SELECT id, name, price_pence FROM events WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'not found' });
  if (!rows[0].price_pence) return res.status(400).json({ error: 'this event is free — just attend' });
  if (!stripeReady) return res.status(503).json({ error: 'payments are not available right now' });

  const already = await q(
    'SELECT 1 FROM event_attendees WHERE event_id = $1 AND member_id = $2',
    [req.params.id, req.member.id]);
  if (already.rows[0]) return res.status(409).json({ error: 'you are already attending' });

  /* An unpaid link may already exist — hand the same one back rather than
     salting the ledger with duplicates. */
  const pending = await q(
    `SELECT checkout_url FROM payments
      WHERE event_id = $1 AND member_id = $2 AND status = 'pending'
      ORDER BY created_at DESC LIMIT 1`,
    [req.params.id, req.member.id]);
  if (pending.rows[0]?.checkout_url) {
    return res.json({ checkout_url: pending.rows[0].checkout_url });
  }

  const siteBase = process.env.PUBLIC_SITE_BASE || 'https://connect.navada-edge-server.uk';
  const payment = await createEventCheckout({
    memberId: req.member.id,
    eventId: rows[0].id,
    amountPence: rows[0].price_pence,
    description: `${rows[0].name} — event ticket`,
    siteBase,
  });
  res.json({ checkout_url: payment.checkout_url });
});

/* ----------------------------------------------------------------- replays */

contentRouter.get('/replays', requireMember, async (_req, res) => {
  const { rows } = await q(`
    SELECT id, title, summary, tag, duration, stream_uid, video_key, image_key,
           chapters, speakers, created_at
      FROM replays
     WHERE published
     ORDER BY created_at DESC
  `);
  res.json({
    replays: rows.map((r) => ({
      ...r,
      image_url: r.image_key ? `/media/${r.image_key}` : null,
      has_video: !!(r.video_key || r.stream_uid),
    })),
  });
});

/**
 * Playback is a separate, per-view grant. Stream videos require signed URLs,
 * so a member asks here, we mint a short-lived token, and the video is
 * unplayable anywhere the token did not come from this endpoint.
 */
contentRouter.get('/replays/:id/play', requireMember, async (req, res) => {
  const { rows } = await q(
    'SELECT stream_uid, video_key FROM replays WHERE id = $1 AND published', [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'not found' });

  // Native video: the file streams from /media with range requests, the
  // same pipeline as every feed video. No third-party service involved.
  if (rows[0].video_key) return res.json({ src: `/media/${rows[0].video_key}` });

  if (!rows[0].stream_uid) return res.status(409).json({ error: 'no video attached yet' });
  if (!streamReady) return res.status(503).json({ error: 'video service not configured' });

  try {
    const token = await playbackToken(rows[0].stream_uid);
    res.json({ uid: rows[0].stream_uid, token });
  } catch (e) {
    console.error('[content] playback token failed:', e.message);
    res.status(502).json({ error: 'could not authorise playback' });
  }
});

/* --------------------------------------------------------------- workshops */

contentRouter.get('/workshops', requireMember, async (_req, res) => {
  const { rows } = await q(`
    SELECT w.id, w.title, w.blurb, w.tag, w.level, w.duration, w.sessions,
           w.seats_total, w.seats_taken, w.host_id, w.image_key, w.is_live,
           w.scheduled_for, w.when_label, w.outcomes,
           m.name AS host_name
      FROM workshops w
      LEFT JOIN members m ON m.id = w.host_id
     WHERE w.published
     ORDER BY w.is_live DESC, w.scheduled_for NULLS LAST
  `);
  res.json({
    workshops: rows.map((r) => ({
      ...r,
      image_url: r.image_key ? `/media/${r.image_key}` : null,
    })),
  });
});
