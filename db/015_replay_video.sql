-- Replay video, natively stored. stream_uid remains for any Cloudflare
-- Stream past; video_key is a media storage key served through /media
-- like every other asset (R2 behind the driver, range requests included).
ALTER TABLE replays ADD COLUMN IF NOT EXISTS video_key text;

-- Replay files get their own media kind so the admin panel and MI can
-- tell a 500MB replay from a feed clip.
ALTER TABLE media DROP CONSTRAINT IF EXISTS media_kind_check;
ALTER TABLE media ADD CONSTRAINT media_kind_check
  CHECK (kind IN ('avatar', 'post', 'event', 'article', 'replay', 'other'));
