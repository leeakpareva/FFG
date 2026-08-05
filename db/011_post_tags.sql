-- Tagging people in posts, Instagram-style. A tag is a real join to a real
-- member — renderable as a chip, navigable to their profile, and honest in
-- a way free-text @mentions never are.

CREATE TABLE IF NOT EXISTS post_tags (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

CREATE INDEX IF NOT EXISTS post_tags_member ON post_tags (member_id);
