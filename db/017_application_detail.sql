-- The real membership application: who you are, what you do, why Connect.
-- `name` stays (first + last, for every existing query and email); the
-- parts are kept separately because the admin panel and any future export
-- need them apart.

ALTER TABLE applications ADD COLUMN IF NOT EXISTS first_name    text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS last_name     text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS nationality   text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS identifies_as text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS descriptor    text;   -- Entrepreneur / Founder, ...
ALTER TABLE applications ADD COLUMN IF NOT EXISTS industry      text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS organisation  text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS role_title    text;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS referred_by   text;   -- free text name, when no ?ref= link
ALTER TABLE applications ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;
ALTER TABLE applications ADD COLUMN IF NOT EXISTS privacy_agreed_at timestamptz;
