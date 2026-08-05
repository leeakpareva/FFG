-- Comments. Real rows, real authors — the posts.comments integer was a
-- leftover counter from the demo and is no longer read; the count is
-- computed from here.

CREATE TABLE IF NOT EXISTS post_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS post_comments_post ON post_comments (post_id, created_at);
