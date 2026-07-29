-- =====================================================================
-- Connect — Forbes Family Group
-- Postgres 17 + pgvector schema
--
-- Design notes
--  * Member-facing text lives in normal columns; anything the app renders
--    as a list (highlights, tiles, agenda, article paragraphs) is a child
--    table with an explicit `ord` so display order survives a round trip.
--  * `search_doc` is a generated tsvector per searchable row, and
--    `embedding` is a nullable pgvector column. Lexical search works from
--    day one; semantic ranking switches on once vectors are backfilled,
--    with no schema change needed.
--  * Pillars stay an enum of the client's own taxonomy: Capital,
--    Community, Connect. The nav labels ("Meet") are presentation only and
--    deliberately do not leak into the data model.
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS room_participants, room_speakers, rooms,
  event_attendees, event_agenda, events,
  article_paragraphs, articles,
  post_stats, posts,
  member_tiles, member_highlights, members,
  notifications, messages, threads CASCADE;
DROP TYPE IF EXISTS pillar_t, room_role_t CASCADE;

CREATE TYPE pillar_t    AS ENUM ('Capital', 'Community', 'Connect');
CREATE TYPE room_role_t AS ENUM ('speaker', 'listener');

-- ---------------------------------------------------------------- members
CREATE TABLE members (
  id           text PRIMARY KEY,                 -- "LA", "FF" — initials used across the UI
  clerk_id     text UNIQUE,                      -- set once a real member signs in
  name         text        NOT NULL,
  handle       text UNIQUE NOT NULL,
  role         text        NOT NULL,
  pillar       pillar_t    NOT NULL,
  bio          text,
  verified     boolean     NOT NULL DEFAULT false,
  is_org       boolean     NOT NULL DEFAULT false,
  posts_count  integer     NOT NULL DEFAULT 0,
  followers    text        NOT NULL DEFAULT '0', -- display string: "750K", "1,204"
  following    integer     NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  search_doc   tsvector GENERATED ALWAYS AS (
                 setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(handle, '')), 'A') ||
                 setweight(to_tsvector('english', coalesce(role, '')), 'B') ||
                 setweight(to_tsvector('english', coalesce(bio, '')), 'C')
               ) STORED,
  embedding    vector(1536)
);

CREATE TABLE member_highlights (
  member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ord       integer NOT NULL,
  icon      text    NOT NULL,
  label     text    NOT NULL,
  PRIMARY KEY (member_id, ord)
);

CREATE TABLE member_tiles (
  member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ord       integer NOT NULL,
  kind      text    NOT NULL CHECK (kind IN ('stat', 'quote', 'icon')),
  value     text,
  label     text,
  colour    text,
  icon      text,
  PRIMARY KEY (member_id, ord)
);

-- ------------------------------------------------------------------ posts
CREATE TABLE posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   text     NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body        text     NOT NULL,
  pillar      pillar_t NOT NULL,
  image_key   text,
  likes       integer  NOT NULL DEFAULT 0,
  comments    integer  NOT NULL DEFAULT 0,
  stat_label  text,
  stat_value  text,
  posted_at   timestamptz NOT NULL DEFAULT now(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  search_doc  tsvector GENERATED ALWAYS AS (
                to_tsvector('english', coalesce(body, ''))
              ) STORED,
  embedding   vector(1536)
);

-- ----------------------------------------------------------------- events
CREATE TABLE events (
  id          text PRIMARY KEY,
  name        text     NOT NULL,
  venue       text     NOT NULL,
  day         text     NOT NULL,               -- "31"
  month       text     NOT NULL,               -- "JUL"
  starts_at   timestamptz,
  time_label  text,                            -- "8:00 – 10:00 AM"
  tag         pillar_t NOT NULL,
  spots       text,
  host_id     text REFERENCES members(id) ON DELETE SET NULL,
  image_key   text,
  about       text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  search_doc  tsvector GENERATED ALWAYS AS (
                setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
                setweight(to_tsvector('english', coalesce(venue, '')), 'B') ||
                setweight(to_tsvector('english', coalesce(about, '')), 'C')
              ) STORED,
  embedding   vector(1536)
);

CREATE TABLE event_agenda (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  ord      integer NOT NULL,
  at_time  text    NOT NULL,
  item     text    NOT NULL,
  PRIMARY KEY (event_id, ord)
);

CREATE TABLE event_attendees (
  event_id   text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  rsvp_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, member_id)
);

-- ------------------------------------------------------------------ rooms
CREATE TABLE rooms (
  id            text PRIMARY KEY,
  title         text     NOT NULL,
  description   text,
  tag           pillar_t NOT NULL,
  is_live       boolean  NOT NULL DEFAULT false,
  scheduled_for text,                          -- "Today 7 PM"
  base_listeners integer NOT NULL DEFAULT 0,   -- seeded baseline; live count adds participants
  created_at    timestamptz NOT NULL DEFAULT now(),
  search_doc    tsvector GENERATED ALWAYS AS (
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(description, '')), 'C')
                ) STORED,
  embedding     vector(1536)
);

CREATE TABLE room_speakers (
  room_id   text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  ord       integer NOT NULL,
  PRIMARY KEY (room_id, member_id)
);

-- Live presence. A row exists only while a member is actually in the room,
-- so `DELETE` on leave keeps the listener count honest. `last_seen_at` lets
-- a sweeper reap participants whose browser closed without leaving cleanly.
CREATE TABLE room_participants (
  room_id      text NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  member_id    text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  role         room_role_t NOT NULL DEFAULT 'listener',
  hand_raised  boolean     NOT NULL DEFAULT false,
  muted        boolean     NOT NULL DEFAULT true,
  joined_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (room_id, member_id)
);

-- ------------------------------------------------------------------ reads
CREATE TABLE articles (
  id            text PRIMARY KEY,
  title         text     NOT NULL,
  excerpt       text,
  tag           pillar_t NOT NULL,
  author_id     text REFERENCES members(id) ON DELETE SET NULL,
  read_time     text,
  image_key     text,
  published_label text,
  is_ai         boolean  NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  search_doc    tsvector GENERATED ALWAYS AS (
                  setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                  setweight(to_tsvector('english', coalesce(excerpt, '')), 'B')
                ) STORED,
  embedding     vector(1536)
);

CREATE TABLE article_paragraphs (
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  ord        integer NOT NULL,
  body       text    NOT NULL,
  PRIMARY KEY (article_id, ord)
);

-- --------------------------------------------------------------- messaging
CREATE TABLE threads (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_a   text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  member_b   text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT thread_pair_unique UNIQUE (member_a, member_b),
  CONSTRAINT thread_pair_ordered CHECK (member_a < member_b)
);

CREATE TABLE messages (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id  uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body       text NOT NULL,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE notifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id   text NOT NULL REFERENCES members(id) ON DELETE CASCADE, -- recipient
  actor_id    text REFERENCES members(id) ON DELETE CASCADE,
  kind        text NOT NULL,
  body        text NOT NULL,
  unread      boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------- indexes
CREATE INDEX members_search_idx  ON members  USING gin (search_doc);
CREATE INDEX posts_search_idx    ON posts    USING gin (search_doc);
CREATE INDEX events_search_idx   ON events   USING gin (search_doc);
CREATE INDEX rooms_search_idx    ON rooms    USING gin (search_doc);
CREATE INDEX articles_search_idx ON articles USING gin (search_doc);

-- Trigram indexes carry the "kem" -> "Kemi" prefix matching that a
-- tsvector alone will not do.
CREATE INDEX members_name_trgm  ON members  USING gin (name  gin_trgm_ops);
CREATE INDEX events_name_trgm   ON events   USING gin (name  gin_trgm_ops);
CREATE INDEX rooms_title_trgm   ON rooms    USING gin (title gin_trgm_ops);
CREATE INDEX articles_title_trgm ON articles USING gin (title gin_trgm_ops);

CREATE INDEX posts_member_idx      ON posts (member_id, posted_at DESC);
CREATE INDEX room_participants_room ON room_participants (room_id);
CREATE INDEX messages_thread_idx   ON messages (thread_id, created_at);
CREATE INDEX notifications_member  ON notifications (member_id, created_at DESC);

-- Vector indexes are created empty; they start paying off once embeddings
-- are backfilled. HNSW handles incremental inserts better than IVFFlat.
CREATE INDEX members_embedding_idx  ON members  USING hnsw (embedding vector_cosine_ops);
CREATE INDEX posts_embedding_idx    ON posts    USING hnsw (embedding vector_cosine_ops);
CREATE INDEX articles_embedding_idx ON articles USING hnsw (embedding vector_cosine_ops);

-- ------------------------------------------------------------------ views
-- Live listener count = seeded baseline + whoever is genuinely present.
CREATE OR REPLACE VIEW room_state AS
SELECT r.id, r.title, r.description, r.tag, r.is_live, r.scheduled_for,
       r.base_listeners + count(p.member_id) AS listeners,
       count(p.member_id) FILTER (WHERE p.hand_raised) AS hands_raised
FROM rooms r
LEFT JOIN room_participants p ON p.room_id = r.id
GROUP BY r.id;
