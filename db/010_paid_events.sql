-- Paid events. A price on an event turns "Attend" into a Stripe checkout;
-- the webhook granting the seat is what makes payment and attendance one
-- fact instead of two.

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS price_pence int CHECK (price_pence IS NULL OR price_pence > 0);

-- A payment can now be *for* something. NULL means a plain invoice, as before.
ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS event_id text REFERENCES events(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS payments_event ON payments (event_id) WHERE event_id IS NOT NULL;
