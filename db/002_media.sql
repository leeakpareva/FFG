-- =====================================================================
-- Media / assets
--
-- Binary never goes in Postgres. Files land in object storage (Cloudflare
-- R2 — the `navada-assets` bucket already on the account) and this table
-- holds the metadata plus the storage key. That keeps the database small,
-- lets the CDN serve images, and means a row delete is cheap.
--
-- Uploads are brokered by a presigned PUT: the API mints a short-lived URL
-- for a key it chooses, so the browser never holds an R2 credential and
-- cannot pick its own path.
-- =====================================================================

CREATE TABLE IF NOT EXISTS media (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id     text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  storage_key  text UNIQUE NOT NULL,          -- e.g. "members/LA/2026/uuid.jpg"
  kind         text NOT NULL CHECK (kind IN ('avatar', 'post', 'event', 'article', 'other')),
  mime_type    text NOT NULL,
  byte_size    bigint NOT NULL CHECK (byte_size > 0),
  width        integer,
  height       integer,
  alt_text     text,
  -- Set once the browser confirms the PUT succeeded. Rows that never flip
  -- to true are abandoned uploads and can be swept.
  uploaded     boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS media_owner_idx ON media (owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS media_unconfirmed_idx ON media (created_at) WHERE NOT uploaded;

-- Point the content tables at uploaded media. image_key stays for the
-- seeded demo art; media_id wins when present.
ALTER TABLE members  ADD COLUMN IF NOT EXISTS avatar_media_id uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE posts    ADD COLUMN IF NOT EXISTS media_id        uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE events   ADD COLUMN IF NOT EXISTS media_id        uuid REFERENCES media(id) ON DELETE SET NULL;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS media_id        uuid REFERENCES media(id) ON DELETE SET NULL;
