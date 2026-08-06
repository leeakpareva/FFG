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
import crypto from 'node:crypto';
import { q } from './db.js';
import {
  sendMail, ffgEmail, emailButton, emailStep, escapeHtml, applyNotify,
  APP_BASE, SITE_BASE,
} from './mailer.js';
import { stripeReady, createApplicationHold, PLAN_LABELS } from './stripe.js';
import { sendReviewerAlert } from './applicationEmails.js';

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

/* The closed lists the form offers. Anything else is rejected rather than
   stored, so the admin panel can never be fed arbitrary strings. */
const IDENTITIES = ['Woman', 'Man', 'Non-binary', 'Prefer to self-describe', 'Prefer not to say'];
const DESCRIPTORS = [
  'Entrepreneur / Founder', 'Intrapreneur / Corporate Senior Leader',
  'Corporate Professional', 'Professional / Vocational', 'Network Builder',
  'Creative / Freelancer', 'Other',
];
const INDUSTRIES = [
  'Finance & Investment', 'Technology', 'Media & Entertainment',
  'Retail & E-commerce', 'Real Estate', 'Health & Wellness',
  'Professional Services', 'Hospitality & Events', 'Fashion & Luxury', 'Other',
];

/** Whole years between a date of birth and today. */
function ageOn(dob) {
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const before =
    now.getUTCMonth() < dob.getUTCMonth() ||
    (now.getUTCMonth() === dob.getUTCMonth() && now.getUTCDate() < dob.getUTCDate());
  return before ? age - 1 : age;
}

publicRouter.post('/apply', async (req, res) => {
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '?';
  const b = req.body || {};

  // Honeypot: no human ever fills "company" (it is invisible). Answer as if
  // it worked so the bot learns nothing.
  if (b.company) return res.status(201).json({ ok: true });

  if (limited(ip)) return res.status(429).json({ error: 'Too many applications from this connection — try again later.' });

  const str = (v, max) => String(v ?? '').trim().slice(0, max);

  /* Transitional: the previously-deployed site form sends only name/email/
     phone/about. While Vercel blocks the deploy that carries the full form,
     that shape files as a minimal part one — the rest arrives via part two
     and review. Remove once the new site is live. */
  const legacy = !b.first_name && !b.last_name && b.name;

  let firstName = str(b.first_name, 60);
  let lastName = str(b.last_name, 60);
  const cleanEmail = str(b.email, 200).toLowerCase();
  const phone = str(b.phone, 40);
  const nationality = str(b.nationality, 60);
  const identifiesAs = str(b.identifies_as, 60);
  const descriptor = str(b.descriptor, 60);
  const industry = str(b.industry, 60);
  const organisation = str(b.organisation, 120);
  const roleTitle = str(b.role_title, 120);
  const about = str(b.about, 400);
  const referredBy = str(b.referred_by, 120);
  let dob = null;

  if (legacy) {
    const parts = str(b.name, 120).split(/\s+/).filter(Boolean);
    firstName = parts[0] || '';
    lastName = parts.slice(1).join(' ');
    const missing = [];
    if (!firstName) missing.push('your name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) missing.push('a valid email address');
    if (!phone) missing.push('contact number');
    if (!about) missing.push('why you want to join');
    if (missing.length) {
      return res.status(400).json({ error: `Please complete: ${missing.join(', ')}.` });
    }
  } else {
    const missing = [];
    if (!firstName) missing.push('first name');
    if (!lastName) missing.push('last name');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) missing.push('a valid email address');
    if (!phone) missing.push('contact number');
    if (!nationality) missing.push('nationality');
    if (!organisation) missing.push('organisation');
    if (!roleTitle) missing.push('role');
    if (!about) missing.push('why you want to join');
    if (missing.length) {
      return res.status(400).json({ error: `Please complete: ${missing.join(', ')}.` });
    }

    if (identifiesAs && !IDENTITIES.includes(identifiesAs)) return res.status(400).json({ error: 'Please choose how you identify from the list.' });
    if (!DESCRIPTORS.includes(descriptor)) return res.status(400).json({ error: 'Please choose how you would describe yourself.' });
    if (!INDUSTRIES.includes(industry)) return res.status(400).json({ error: 'Please choose your industry.' });

    // 18+ is a condition of applying, so it is checked here as well as in the
    // browser: a form control is a courtesy, not a rule.
    dob = new Date(str(b.date_of_birth, 10));
    if (Number.isNaN(dob.getTime())) return res.status(400).json({ error: 'Please give your date of birth.' });
    const age = ageOn(dob);
    if (age < 18) return res.status(400).json({ error: 'You must be 18 or over to apply.' });
    if (age > 120) return res.status(400).json({ error: 'Please check your date of birth.' });

    // The privacy consent is the lawful basis for holding any of this.
    // (Legacy applicants give it at part two, which requires it.)
    if (b.privacy_agreed !== true) {
      return res.status(400).json({ error: 'Please agree to the Privacy Policy to continue.' });
    }
  }

  const cleanName = [firstName, lastName].filter(Boolean).join(' ');
  // The applicant's private way back in to finish part two.
  const token = crypto.randomBytes(24).toString('base64url');

  let application;
  try {
    const { rows } = await q(
      `INSERT INTO applications
         (name, first_name, last_name, email, phone, about, referral,
          date_of_birth, nationality, identifies_as, descriptor, industry,
          organisation, role_title, referred_by, marketing_opt_in,
          privacy_agreed_at, status, detail_token, details_sent_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,
               $17, 'awaiting_details', $18, now())
       RETURNING id, created_at`,
      [
        cleanName, firstName, lastName || null, cleanEmail, phone, about,
        str(b.referral, 24) || null,
        dob ? dob.toISOString().slice(0, 10) : null,
        nationality || null, identifiesAs || null, descriptor || null, industry || null,
        organisation || null, roleTitle || null, referredBy || null,
        b.marketing_opt_in === true,
        legacy ? null : new Date(), token,
      ]
    );
    application = rows[0];
  } catch (e) {
    if (e.code === '23505') {
      // Already an open application for this email — that is a success from
      // the applicant's point of view, not an error to bounce off.
      return res.status(201).json({ ok: true });
    }
    throw e;
  }

  /* Part two: the applicant is invited to finish. The reviewers are not
     told yet — a half-finished application is not something to review. */
  const continueUrl = `${SITE_BASE}/apply/continue?t=${token}`;
  sendMail({
    to: cleanEmail,
    subject: 'Your FFG Connect application — one more step',
    html: ffgEmail(`
      <p style="margin:0 0 6px;text-align:center;font-size:10px;letter-spacing:3px;color:#8A867C;">MEMBERSHIP APPLICATION</p>
      <h1 style="margin:6px 0 18px;text-align:center;font-family:Georgia,serif;font-weight:normal;font-size:27px;line-height:1.2;color:#17171B;">
        Your Membership Application is in Review
      </h1>
      <p style="margin:0 0 14px;">Dear ${escapeHtml(firstName)},</p>
      <p style="margin:0 0 14px;">
        Thank you for applying to FFG Connect. We&rsquo;ve received the first part
        of your application and it&rsquo;s now with our team.
      </p>
      <p style="margin:0 0 22px;">
        To finish your application, we&rsquo;d like to know a little more about you.
        It should only take a few minutes, and these are the questions that
        matter most to us.
      </p>
      ${emailStep('03', 'Tell Us About You',
        'Who you are and what drives you, what you would bring to the community and hope to gain from it, what would make membership genuinely worth it, and your income bracket. The last one shapes future offerings and is never a deciding factor.')}
      ${emailStep('04', 'Find You Online',
        'LinkedIn is required. Your Instagram handle and website or portfolio are optional but appreciated.')}
      ${emailStep('05', 'Last Few Things',
        'How you heard about FFG Connect, and confirmation that you are happy with how we will use your information.')}
      ${emailButton(continueUrl, 'Continue your application')}
      <p style="margin:0;text-align:center;color:#8A867C;font-size:13px;">
        We review every application personally. If your application is
        successful, we&rsquo;ll be in touch.
      </p>
    `, { footer: 'full' }),
  });

  res.status(201).json({ ok: true, id: application.id, stage: 'awaiting_details' });
});

/* ------------------------------------------------- part two: the detail */

const INCOME_BRACKETS = [
  'Under £30,000', '£30,000 – £49,999', '£50,000 – £74,999',
  '£75,000 – £99,999', '£100,000 – £149,999', '£150,000 – £249,999',
  '£250,000+', 'Prefer not to say',
];
const HEARD_ABOUT = [
  'A member referred me', 'Social media', 'An FFG event', 'Press or media',
  'Search', 'Word of mouth', 'Other',
];

/** The lists part two offers, so the form and the server agree. */
/**
 * Anonymous funnel beacons from the public site: started the form, finished
 * part one, finished part two. A step and a timestamp — no PII, so no
 * consent question arises. Lightly rate-limited per IP.
 */
const beaconCounts = new Map(); // ip -> { count, first }
publicRouter.post('/apply/track', async (req, res) => {
  const step = String(req.body?.step || '');
  if (!['apply_started', 'apply_part1_done', 'apply_part2_done'].includes(step)) {
    return res.status(204).end(); // never give a probe a signal
  }
  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '?';
  const c = beaconCounts.get(ip);
  if (!c || Date.now() - c.first > 60 * 60 * 1000) beaconCounts.set(ip, { count: 1, first: Date.now() });
  else if (++c.count > 60) return res.status(204).end();
  try { await q('INSERT INTO site_events (step) VALUES ($1)', [step]); } catch { /* un-migrated */ }
  res.status(204).end();
});

/* --------------------------------------------------------- public events */

/**
 * The events page on the public website. Public facts only: what, where,
 * when — no host contact details, no member data.
 */
publicRouter.get('/public/events', async (_req, res) => {
  const { rows } = await q(`
    SELECT e.id, e.name, e.venue, e.day, e.month, e.time_label, e.tag,
           e.about, e.image_key, e.price_pence, e.starts_at,
           (SELECT count(*)::int FROM event_attendees a WHERE a.event_id = e.id)
         + (SELECT count(*)::int FROM event_guests g WHERE g.event_id = e.id) AS going
      FROM events e
     ORDER BY e.starts_at NULLS LAST, e.created_at DESC`);
  res.set('Cache-Control', 'public, max-age=60');
  res.json({
    events: rows.map(r => ({
      ...r,
      image_key: undefined,
      image_url: r.image_key ? `/media/${r.image_key}` : null,
    })),
  });
});

/** A visitor reserves a seat: name + email, one per event. Honeypot + rate limit. */
const guestCounts = new Map(); // ip -> { count, first }
publicRouter.post('/public/events/:id/rsvp', async (req, res) => {
  const b = req.body || {};
  if (b.company) return res.status(201).json({ ok: true }); // honeypot

  const ip = req.headers['x-real-ip'] || req.socket.remoteAddress || '?';
  const c = guestCounts.get(ip);
  if (!c || Date.now() - c.first > 60 * 60 * 1000) guestCounts.set(ip, { count: 1, first: Date.now() });
  else if (++c.count > 10) return res.status(429).json({ error: 'Too many requests — try again later.' });

  const name = String(b.name || '').trim().slice(0, 120);
  const email = String(b.email || '').trim().toLowerCase().slice(0, 200);
  if (!name) return res.status(400).json({ error: 'Please give your name.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return res.status(400).json({ error: 'Please give a valid email address.' });

  const event = await q('SELECT id, name, venue, day, month, time_label, starts_at, price_pence FROM events WHERE id = $1', [req.params.id]);
  if (!event.rows[0]) return res.status(404).json({ error: 'That event no longer exists.' });
  const e = event.rows[0];

  try {
    await q('INSERT INTO event_guests (event_id, name, email) VALUES ($1, $2, $3)', [e.id, name, email]);
  } catch (err) {
    if (err.code === '23505') return res.status(201).json({ ok: true }); // already on the list
    throw err;
  }

  const when = [e.day && e.month ? `${e.day} ${e.month}` : null, e.time_label].filter(Boolean).join(' · ');
  sendMail({
    to: email,
    subject: `Your place: ${e.name}`,
    html: ffgEmail(`
      <p style="margin:0 0 6px;text-align:center;font-size:10px;letter-spacing:3px;color:#8A867C;">SEE YOU THERE</p>
      <h1 style="margin:6px 0 18px;text-align:center;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.2;color:#17171B;">
        ${escapeHtml(e.name)}
      </h1>
      <p style="margin:0 0 14px;">Dear ${escapeHtml(name.split(' ')[0])},</p>
      <p style="margin:0 0 14px;">Thank you — your interest is registered${when ? ` for <strong>${escapeHtml(when)}</strong>` : ''}${e.venue ? ` at ${escapeHtml(e.venue)}` : ''}.</p>
      ${e.price_pence ? `<p style="margin:0 0 14px;">This is a ticketed event — the team will be in touch with the details.</p>` : `<p style="margin:0 0 14px;">We will send a reminder the day before.</p>`}
      <p style="margin:14px 0 0;">Forbes Family Group</p>
    `, { footer: 'full' }),
  });

  res.status(201).json({ ok: true });
});

publicRouter.get('/apply/options', (_req, res) => {
  res.set('Cache-Control', 'public, max-age=3600');
  res.json({ income_brackets: INCOME_BRACKETS, heard_about: HEARD_ABOUT });
});

/** Does this link still open a door, and whose? */
publicRouter.get('/apply/continue', async (req, res) => {
  const token = String(req.query.t || '').slice(0, 64);
  if (!token) return res.status(400).json({ error: 'missing link' });
  const { rows } = await q(
    'SELECT first_name, status FROM applications WHERE detail_token = $1', [token]
  );
  if (!rows[0]) return res.status(404).json({ error: 'This link is not valid. Please apply again from the website.' });
  if (rows[0].status !== 'awaiting_details') {
    return res.json({ first_name: rows[0].first_name, already_complete: true });
  }
  res.json({ first_name: rows[0].first_name, already_complete: false });
});

publicRouter.post('/apply/complete', async (req, res) => {
  const b = req.body || {};
  if (b.company) return res.status(201).json({ ok: true }); // honeypot

  const token = String(b.token || '').slice(0, 64);
  const { rows } = await q(
    `SELECT * FROM applications WHERE detail_token = $1 AND status = 'awaiting_details'`, [token]
  );
  const app = rows[0];
  if (!app) return res.status(404).json({ error: 'This link is not valid, or your application is already complete.' });

  const str = (v, max) => String(v ?? '').trim().slice(0, max);
  const story = str(b.story, 2000);
  const contribution = str(b.contribution, 2000);
  const worthIt = str(b.worth_it, 2000);
  const income = str(b.income_bracket, 40);
  const linkedin = str(b.linkedin_url, 300);
  const instagram = str(b.instagram_handle, 60).replace(/^@/, '');
  const website = str(b.website_url, 300);
  const heard = str(b.heard_about, 60);

  const missing = [];
  if (!story) missing.push('your story');
  if (!contribution) missing.push('what you would bring and gain');
  if (!worthIt) missing.push('what would make membership worth it');
  if (!linkedin) missing.push('your LinkedIn');
  if (missing.length) return res.status(400).json({ error: `Please complete: ${missing.join(', ')}.` });

  if (income && !INCOME_BRACKETS.includes(income)) return res.status(400).json({ error: 'Please choose an income bracket from the list.' });
  if (heard && !HEARD_ABOUT.includes(heard)) return res.status(400).json({ error: 'Please choose how you heard about us from the list.' });
  if (!/^https?:\/\/(www\.)?linkedin\.com\/.+/i.test(linkedin)) {
    return res.status(400).json({ error: 'Please give the full address of your LinkedIn profile.' });
  }
  if (website && !/^https?:\/\/.+\..+/.test(website)) {
    return res.status(400).json({ error: 'Please give the full address of your website, starting with https://' });
  }
  if (b.privacy_agreed !== true) {
    return res.status(400).json({ error: 'Please confirm you are happy with how we will use your information.' });
  }

  /* The membership plan: the fee is authorised now, taken only on approval. */
  const plan = ['annual', 'quarterly'].includes(b.plan) ? b.plan : null;
  if (stripeReady && !plan) {
    return res.status(400).json({ error: 'Please choose a membership plan.' });
  }

  await q(
    `UPDATE applications
        SET story = $2, contribution = $3, worth_it = $4, income_bracket = $5,
            linkedin_url = $6, instagram_handle = $7, website_url = $8,
            heard_about = $9, plan = $10, status = 'pending', details_done_at = now(),
            detail_token = NULL
      WHERE id = $1`,
    [app.id, story, contribution, worthIt, income || null,
     linkedin, instagram || null, website || null, heard || null, plan]
  );

  if (stripeReady && plan) {
    /* Hold the fee on their card. Reviewers hear about the application only
       when the hold lands (the Stripe webhook) — a whole application now
       means details AND payment. */
    try {
      const { session, amount } = await createApplicationHold({
        applicationId: app.id, plan, email: app.email, siteBase: SITE_BASE,
      });
      await q(
        `UPDATE applications SET amount_pence = $2, payment_status = 'unpaid', checkout_url = $3
          WHERE id = $1`,
        [app.id, amount, session.url]
      );
      // The way back if they close the payment page: the link in their inbox.
      sendMail({
        to: app.email,
        subject: 'One last step — authorise your membership fee',
        html: ffgEmail(`
          <p style="margin:0 0 6px;text-align:center;font-size:10px;letter-spacing:3px;color:#8A867C;">MEMBERSHIP APPLICATION</p>
          <h1 style="margin:6px 0 18px;text-align:center;font-family:Georgia,serif;font-weight:normal;font-size:26px;line-height:1.2;color:#17171B;">
            One last step
          </h1>
          <p style="margin:0 0 14px;">Dear ${escapeHtml(app.first_name || app.name.split(' ')[0])},</p>
          <p style="margin:0 0 14px;">Your application is written. The final step is to authorise
          your membership fee — <strong>${escapeHtml(PLAN_LABELS[plan])}</strong>.</p>
          <p style="margin:0 0 14px;">The amount is <strong>held on your card, not taken</strong>.
          If your application is not successful the hold is released in full. If you are
          approved, the payment completes and your membership begins.</p>
          ${emailButton(session.url, 'Authorise my membership fee')}
          <p style="margin:0;color:#8A867C;font-size:13px;text-align:center;">Nothing reaches our
          review team until this step is done.</p>
        `, { footer: 'full' }),
      });
      return res.status(201).json({ ok: true, checkout_url: session.url });
    } catch (e) {
      console.error('[apply] payment hold failed:', e.message);
      /* Stripe hiccup: never lose the application — review proceeds unpaid
         and the team arranges payment at approval. */
    }
  }

  /* No Stripe (or it failed): the application is whole now, tell the reviewers. */
  const fresh = await q('SELECT * FROM applications WHERE id = $1', [app.id]);
  sendReviewerAlert(fresh.rows[0]).catch(e => console.error('[apply] reviewer alert failed:', e.message));

  res.status(201).json({ ok: true });
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
