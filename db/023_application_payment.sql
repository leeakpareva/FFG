-- =====================================================================
-- Membership payment at application time.
--
-- The applicant picks a plan at part two and authorises the fee on their
-- card: Stripe holds the money without taking it (manual capture).
-- Rejection cancels the hold; approval captures it, and the welcome email
-- says so. Card holds lapse after ~7 days, so reviews should happen
-- inside that window — the admin shows when a hold was placed.
--
--   payment_status: none      Stripe not configured, or legacy application
--                   unpaid    part two done, checkout not completed yet
--                   held      authorised; reviewers have been told
--                   captured  approved and taken
--                   released  rejected, hold cancelled
--                   capture_failed  approval tried to take an expired hold
-- =====================================================================

ALTER TABLE applications ADD COLUMN IF NOT EXISTS plan text
  CHECK (plan IS NULL OR plan IN ('annual', 'quarterly'));
ALTER TABLE applications ADD COLUMN IF NOT EXISTS amount_pence integer;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'none'
  CHECK (payment_status IN ('none', 'unpaid', 'held', 'captured', 'released', 'capture_failed'));
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_intent_id text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS checkout_url text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS payment_held_at timestamptz;
