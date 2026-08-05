/**
 * Stripe payments.
 *
 * The `payments` table is the ledger and the source of truth; Stripe is the
 * rail. Admin creates a charge → we make a Checkout Session → the link is
 * stored and sent to the member → the webhook flips the row to paid. Manual
 * payments (bank transfer, cash) write the same ledger, so revenue reporting
 * does not care how the money arrived.
 *
 * No keys → payments still work as a manual ledger; Stripe-specific actions
 * return 503 with a clear message and the admin UI shows "Stripe not
 * connected". Test keys behave identically to live ones — that IS the
 * rollout path.
 */
import Stripe from 'stripe';
import express from 'express';
import crypto from 'node:crypto';
import { q } from './db.js';
import { track } from './track.js';

const KEY = process.env.STRIPE_SECRET_KEY;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;

export const stripeReady = !!KEY;
export const stripeTestMode = !!KEY && KEY.startsWith('sk_test_');

const stripe = KEY ? new Stripe(KEY) : null;

export const payId = () => 'pay_' + crypto.randomBytes(8).toString('hex');

/**
 * Creates the ledger row and, when Stripe is connected, the Checkout link
 * for it. `siteBase` is where Stripe sends the member back afterwards.
 */
export async function createPayment({ memberId, amountPence, description, siteBase }) {
  const id = payId();

  if (!stripe) {
    // Ledger-only entry: recorded as pending, settled by hand.
    const { rows } = await q(
      `INSERT INTO payments (id, member_id, amount_pence, description, method)
       VALUES ($1, $2, $3, $4, 'manual') RETURNING *`,
      [id, memberId, amountPence, description]
    );
    return rows[0];
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: amountPence,
        product_data: { name: description },
      },
    }],
    success_url: `${siteBase}/?payment=thanks`,
    cancel_url: `${siteBase}/?payment=cancelled`,
  });

  const { rows } = await q(
    `INSERT INTO payments
       (id, member_id, amount_pence, description, method, stripe_checkout_id, checkout_url)
     VALUES ($1, $2, $3, $4, 'stripe', $5, $6) RETURNING *`,
    [id, memberId, amountPence, description, session.id, session.url]
  );
  return rows[0];
}

/**
 * A checkout for an event ticket. Same ledger, plus the event linkage the
 * webhook uses to grant the seat.
 */
export async function createEventCheckout({ memberId, eventId, amountPence, description, siteBase }) {
  if (!stripe) throw new Error('stripe not configured');
  const id = payId();
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    client_reference_id: id,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'gbp',
        unit_amount: amountPence,
        product_data: { name: description },
      },
    }],
    success_url: `${siteBase}/?payment=thanks`,
    cancel_url: `${siteBase}/?payment=cancelled`,
  });
  const { rows } = await q(
    `INSERT INTO payments
       (id, member_id, amount_pence, description, method, stripe_checkout_id, checkout_url, event_id)
     VALUES ($1,$2,$3,$4,'stripe',$5,$6,$7) RETURNING *`,
    [id, memberId, amountPence, description, session.id, session.url, eventId]
  );
  return rows[0];
}

/**
 * The webhook router. Mounted with express.raw BEFORE the global JSON
 * parser — Stripe's signature covers the exact bytes, and a parsed-then-
 * reserialised body never verifies.
 */
export const stripeWebhookRouter = express.Router();

stripeWebhookRouter.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !WEBHOOK_SECRET) return res.status(503).end();

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], WEBHOOK_SECRET);
  } catch (e) {
    console.error('[stripe] bad webhook signature:', e.message);
    return res.status(400).end();
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const ledgerId = session.client_reference_id;
    const { rows } = await q(
      `UPDATE payments
          SET status = 'paid', paid_at = now(), stripe_payment_intent = $2
        WHERE id = $1 AND status = 'pending'
      RETURNING member_id, amount_pence, event_id`,
      [ledgerId, session.payment_intent || null]
    );
    if (rows[0]) {
      track(rows[0].member_id, 'payment_paid', { payment: ledgerId, amount_pence: rows[0].amount_pence });
      /* A ticket purchase IS the RSVP — the paid seat appears the moment
         Stripe confirms. */
      if (rows[0].event_id) {
        await q(`INSERT INTO event_attendees (event_id, member_id) VALUES ($1, $2)
                 ON CONFLICT DO NOTHING`, [rows[0].event_id, rows[0].member_id]);
        track(rows[0].member_id, 'event_paid', { event: rows[0].event_id, payment: ledgerId });
      }
    }
  } else if (event.type === 'checkout.session.expired') {
    await q(`UPDATE payments SET status = 'void' WHERE stripe_checkout_id = $1 AND status = 'pending'`,
      [event.data.object.id]);
  }

  res.json({ received: true });
});
