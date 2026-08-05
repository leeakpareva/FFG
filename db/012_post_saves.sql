-- Saved posts — the bookmark. One row per member per post, same shape as
-- likes, so "Saved posts" on the profile menu is a real list.

CREATE TABLE IF NOT EXISTS post_saves (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

CREATE INDEX IF NOT EXISTS post_saves_member ON post_saves (member_id, created_at);
