-- =====================================================================
-- Public event RSVPs from the website.
--
-- Visitors are not members: a guest seat is a name, an email and the
-- event, nothing more. One row per email per event. Guests appear in the
-- admin guest list beside member RSVPs and get the same T-24h reminder,
-- claimed exactly-once via reminded_at.
-- =====================================================================

CREATE TABLE IF NOT EXISTS event_guests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name        text NOT NULL,
  email       text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  reminded_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS event_guests_one_seat
  ON event_guests (event_id, lower(email));
