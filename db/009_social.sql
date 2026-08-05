-- The social layer becomes real: follows and per-member likes get tables,
-- which is what lets follower counts and like counts be computed truths
-- instead of the seeded numbers the members table was carrying.

CREATE TABLE IF NOT EXISTS follows (
  follower_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  followee_id text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CONSTRAINT no_self_follow CHECK (follower_id <> followee_id)
);

CREATE INDEX IF NOT EXISTS follows_followee ON follows (followee_id);

-- One like per member per post, enforced where it should be.
CREATE TABLE IF NOT EXISTS post_likes (
  post_id    uuid NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (post_id, member_id)
);

-- The seeded vanity numbers are done: zero them so computed counts take
-- over from a truthful baseline. (posts_count/followers/following on
-- members stop being read entirely — they stay for now to avoid a column
-- drop on a live table, and can be dropped in a later sweep.)
UPDATE members SET posts_count = 0, followers = 0, following = 0;
