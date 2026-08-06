-- =====================================================================
-- Named admin accounts.
--
-- The env-configured superadmin (ADMIN_USER / ADMIN_PASSWORD_HASH) stays
-- exactly as it is — it is the break-glass account and never lives in the
-- database. This table adds NAMED team accounts (Ann, Charlene, …) with
-- scoped access, so edits carry a person's name and access can be granted
-- or revoked per area without sharing the master credential.
--
-- Scopes are area names checked by the API ('website', 'marketing',
-- 'applications'); the superadmin implicitly holds every scope.
-- =====================================================================

CREATE TABLE IF NOT EXISTS admin_users (
  username      text PRIMARY KEY CHECK (username = lower(username) AND username ~ '^[a-z0-9_.-]{2,40}$'),
  display_name  text NOT NULL,
  password_hash text NOT NULL,
  scopes        text[] NOT NULL DEFAULT '{}',
  disabled      boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  last_login_at timestamptz
);

-- Site edits now record who made them.
ALTER TABLE site_content ADD COLUMN IF NOT EXISTS updated_by text;
