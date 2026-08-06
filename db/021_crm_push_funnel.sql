-- =====================================================================
-- Three additions in one migration:
--
--   1. Applications become a small CRM: a shortlist stage between pending
--      and decided, reviewer notes (jsonb array of {by, at, text}), and an
--      assignee, so two reviewers can split the queue and record why.
--   2. Web push: one row per browser subscription. The endpoint is the
--      identity; a member signing in on two phones gets two rows.
--   3. The application funnel: anonymous step beacons from the public
--      website (started / part one / part two), so Marketing can see
--      where applicants drop off. No PII — a step and a timestamp.
--
-- Plus: event reminder bookkeeping on event_attendees, so the T-24h
-- email goes out exactly once per seat.
-- =====================================================================

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('awaiting_details', 'pending', 'shortlisted', 'approved', 'rejected'));

ALTER TABLE applications ADD COLUMN IF NOT EXISTS notes       jsonb NOT NULL DEFAULT '[]';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS assigned_to text;

-- A shortlisted application is still open: the same email must not be able
-- to file a second one while it waits.
DROP INDEX IF EXISTS applications_open_email;
CREATE UNIQUE INDEX IF NOT EXISTS applications_open_email
  ON applications (lower(email)) WHERE status IN ('awaiting_details', 'pending', 'shortlisted');

CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint   text PRIMARY KEY,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  keys       jsonb NOT NULL,          -- {p256dh, auth} from the browser
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_member_idx ON push_subscriptions (member_id);

CREATE TABLE IF NOT EXISTS site_events (
  id         bigserial PRIMARY KEY,
  step       text NOT NULL CHECK (step IN ('apply_started', 'apply_part1_done', 'apply_part2_done')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS site_events_step_idx ON site_events (step, created_at DESC);

ALTER TABLE event_attendees ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
