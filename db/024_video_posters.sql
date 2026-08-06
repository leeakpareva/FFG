-- A video post carries a cover photo: auto-captured from the video in the
-- browser at post time, or chosen by the member. Plain image media row,
-- referenced from the post.
ALTER TABLE posts ADD COLUMN IF NOT EXISTS poster_key text;
