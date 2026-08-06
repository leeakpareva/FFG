-- The front door: membership applications from the public FFG website,
-- and the CMS slots that website reads its content from.

CREATE TABLE IF NOT EXISTS applications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  about       text,
  referral    text,                      -- member id from a ?ref= link
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  member_id   text REFERENCES members(id) ON DELETE SET NULL,  -- set on approval
  decided_by  text,                      -- admin username
  decided_at  timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- One live application per email address; decided ones don't block a re-apply.
CREATE UNIQUE INDEX IF NOT EXISTS applications_pending_email
  ON applications (lower(email)) WHERE status = 'pending';

CREATE TABLE IF NOT EXISTS site_content (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
