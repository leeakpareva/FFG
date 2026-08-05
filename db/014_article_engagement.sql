-- Articles join the social loop: real likes and comments, same shape as
-- posts. The fake "120 + title length" like count dies here.

CREATE TABLE IF NOT EXISTS article_likes (
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (article_id, member_id)
);

CREATE TABLE IF NOT EXISTS article_comments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id text NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
  member_id  text NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  body       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS article_comments_article ON article_comments (article_id, created_at);
