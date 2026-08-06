-- =====================================================================
-- Marketing: campaigns and the asset library.
--
-- Campaigns are the planning unit (goal, channels, dates, brief, UTM tag);
-- assets are files in the same media pipeline as everything else (R2 behind
-- the storage driver) with a marketing-specific row carrying title, tags
-- and an optional campaign link. Deleting a campaign keeps its assets —
-- they fall back to the unfiled library.
-- =====================================================================

-- Marketing files get their own media kind.
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_kind_check;
ALTER TABLE media ADD CONSTRAINT media_kind_check
  CHECK (kind IN ('avatar', 'post', 'event', 'article', 'replay', 'marketing', 'other'));

CREATE TABLE IF NOT EXISTS campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  status       text NOT NULL DEFAULT 'draft'
               CHECK (status IN ('draft', 'planned', 'active', 'completed', 'archived')),
  objective    text NOT NULL DEFAULT '',
  audience     text NOT NULL DEFAULT '',
  channels     text[] NOT NULL DEFAULT '{}',
  start_date   date,
  end_date     date,
  budget_pence integer CHECK (budget_pence IS NULL OR budget_pence >= 0),
  brief        text NOT NULL DEFAULT '',
  -- lowercase-with-dashes, used to build utm_campaign links consistently
  utm_campaign text NOT NULL DEFAULT '',
  created_by   text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS campaigns_status_idx ON campaigns (status, created_at DESC);

CREATE TABLE IF NOT EXISTS marketing_assets (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id    uuid NOT NULL REFERENCES media(id) ON DELETE CASCADE,
  campaign_id uuid REFERENCES campaigns(id) ON DELETE SET NULL,
  title       text NOT NULL DEFAULT '',
  tags        text[] NOT NULL DEFAULT '{}',
  uploaded_by text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS marketing_assets_campaign_idx ON marketing_assets (campaign_id, created_at DESC);
