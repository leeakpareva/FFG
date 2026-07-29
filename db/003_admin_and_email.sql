-- =====================================================================
-- Email + admin flag
--
-- `email` lets a Clerk sign-in claim its member row on first login.
-- `is_admin` gates editorial: articles are written by the FFG team only,
-- never by members. Enforced server-side in the API, not just hidden in
-- the UI.
-- =====================================================================

ALTER TABLE members ADD COLUMN IF NOT EXISTS email    text;
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS members_email_key
  ON members (lower(email)) WHERE email IS NOT NULL;

-- Articles record who published them and when they went live.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_by text REFERENCES members(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS published_at timestamptz;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_draft     boolean NOT NULL DEFAULT false;
