-- Applications become two-stage. Part one (who you are, what you do) is
-- filled on the website; the applicant is then emailed a private link to
-- finish part two, and only a completed application reaches the reviewers.

ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check
  CHECK (status IN ('awaiting_details', 'pending', 'approved', 'rejected'));

ALTER TABLE applications ADD COLUMN IF NOT EXISTS story             text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS contribution      text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS worth_it          text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS income_bracket    text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS linkedin_url      text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS instagram_handle  text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS website_url       text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS heard_about       text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS detail_token      text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS details_sent_at   timestamptz;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS details_done_at   timestamptz;

-- The token is the applicant's private way back in, so it must be unique
-- and findable in one hop.
CREATE UNIQUE INDEX IF NOT EXISTS applications_detail_token
  ON applications (detail_token) WHERE detail_token IS NOT NULL;

-- The half-finished-application guard replaces the pending-only one: a
-- person should not be able to start two applications at once either.
DROP INDEX IF EXISTS applications_pending_email;
CREATE UNIQUE INDEX IF NOT EXISTS applications_open_email
  ON applications (lower(email)) WHERE status IN ('awaiting_details', 'pending');
