-- Admin backend: usage analytics, video content, payments.
--
-- Four additions, one theme: everything the admin panel manages or measures
-- gets a real table. Nothing here touches the member-facing tables beyond one
-- new column on members for Stripe.
--
-- Naming note: `events` was already taken by member-facing event listings,
-- so the analytics stream is `usage_events`.

-- ---------------------------------------------------------------- analytics

CREATE TABLE IF NOT EXISTS usage_events (
  id          bigserial PRIMARY KEY,
  member_id   text REFERENCES members(id) ON DELETE SET NULL,
  type        text        NOT NULL,     -- 'active' | 'room_join' | 'media_upload' | ...
  meta        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- The two questions the dashboard asks: "what happened over time?" and
-- "what has this member been doing?"
CREATE INDEX IF NOT EXISTS usage_events_type_time   ON usage_events (type, created_at);
CREATE INDEX IF NOT EXISTS usage_events_member_time ON usage_events (member_id, created_at);

-- ---------------------------------------------------------------- replays

-- Watch shelf. A replay is a recording of something that already happened;
-- the video itself lives in Cloudflare Stream and `stream_uid` points at it.
-- Unpublished rows are drafts: visible in admin, invisible to members.
CREATE TABLE IF NOT EXISTS replays (
  id          text PRIMARY KEY,
  title       text     NOT NULL,
  summary     text,
  tag         pillar_t NOT NULL DEFAULT 'Community',
  duration    text,                      -- "48 min", display only
  stream_uid  text,                      -- Cloudflare Stream video id
  image_key   text,                      -- cover, media storage_key
  chapters    jsonb    NOT NULL DEFAULT '[]'::jsonb,  -- [{t: seconds, label}]
  speakers    text[]   NOT NULL DEFAULT '{}',         -- member ids
  published   boolean  NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  search_doc  tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(summary, '')), 'B')
              ) STORED,
  embedding   vector(1536)
);

-- ---------------------------------------------------------------- workshops

-- Learn shelf. Runs at a fixed time with a cohort — seats are finite, which
-- is the whole difference from a replay.
CREATE TABLE IF NOT EXISTS workshops (
  id            text PRIMARY KEY,
  title         text     NOT NULL,
  blurb         text,
  tag           pillar_t NOT NULL DEFAULT 'Community',
  level         text     NOT NULL DEFAULT 'Beginner',
  duration      text,                    -- "90 min"
  sessions      int      NOT NULL DEFAULT 1,
  seats_total   int      NOT NULL DEFAULT 20,
  seats_taken   int      NOT NULL DEFAULT 0,
  host_id       text REFERENCES members(id) ON DELETE SET NULL,
  image_key     text,
  stream_uid    text,                    -- filled if a session is recorded
  is_live       boolean  NOT NULL DEFAULT false,
  scheduled_for timestamptz,
  when_label    text,                    -- "Tue 12 Aug · 6pm", display only
  outcomes      jsonb    NOT NULL DEFAULT '[]'::jsonb,  -- ["A scorecard per role", ...]
  published     boolean  NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  search_doc    tsvector GENERATED ALWAYS AS (
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(blurb, '')), 'B')
                ) STORED,
  embedding     vector(1536)
);

-- ---------------------------------------------------------------- payments

-- The ledger is the source of truth for revenue whether money moved through
-- Stripe or was recorded by hand (bank transfer, cash). Stripe columns are
-- nullable for exactly that reason.
CREATE TABLE IF NOT EXISTS payments (
  id                 text PRIMARY KEY,              -- "pay_" + random
  member_id          text REFERENCES members(id) ON DELETE SET NULL,
  amount_pence       int         NOT NULL CHECK (amount_pence > 0),
  currency           text        NOT NULL DEFAULT 'gbp',
  description        text        NOT NULL,
  status             text        NOT NULL DEFAULT 'pending',  -- pending | paid | failed | refunded | void
  method             text        NOT NULL DEFAULT 'stripe',   -- stripe | manual
  stripe_checkout_id text,
  stripe_payment_intent text,
  checkout_url       text,
  paid_at            timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_member  ON payments (member_id, created_at);
CREATE INDEX IF NOT EXISTS payments_status  ON payments (status, created_at);

ALTER TABLE members
  ADD COLUMN IF NOT EXISTS stripe_customer_id text;
