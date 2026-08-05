-- Rooms, matching the five in FFGApp.jsx so the screen shows the same thing
-- whether it reads the constants or the API.
--
-- base_listeners is the seeded headline number. The room_state view adds
-- whoever is genuinely present on top, so a real join always moves the count.

INSERT INTO rooms (id, title, description, tag, is_live, scheduled_for, base_listeners)
VALUES
  ('fundraising', 'Fundraising in 2026 - what''s actually working',
   'Angels and founders comparing notes on the current raise climate.',
   'Capital', true, NULL, 142),

  ('firsthire', 'Your first 5 hires',
   'Hiring without a brand, a budget or a talent team.',
   'Connect', true, NULL, 87),

  ('wellness', 'Founder wellbeing - the unglamorous bits',
   'An honest room. No metrics talk allowed.',
   'Community', true, NULL, 54),

  ('diaspora', 'Building for the diaspora market',
   'Payments, logistics and trust, with the GoWave team.',
   'Capital', false, 'Today 7 PM', 203),

  ('brand', 'Brand clinic: live teardowns',
   'Naomi reviews member brands live. Volunteer at your own risk.',
   'Connect', false, 'Fri 1 PM', 156)

ON CONFLICT (id) DO UPDATE
  SET title         = EXCLUDED.title,
      description   = EXCLUDED.description,
      tag           = EXCLUDED.tag,
      is_live       = EXCLUDED.is_live,
      scheduled_for = EXCLUDED.scheduled_for,
      base_listeners = EXCLUDED.base_listeners;

-- Billed speakers. Only members that exist can be billed, so this is limited
-- to the real accounts for now; the demo members (MJ, KB, AO...) have no rows
-- and would fail the foreign key.
INSERT INTO room_speakers (room_id, member_id, ord)
VALUES
  ('fundraising', 'LA', 0),
  ('firsthire',   'CR', 0),
  ('wellness',    'FC', 0),
  ('diaspora',    'CX', 0)
ON CONFLICT (room_id, member_id) DO UPDATE SET ord = EXCLUDED.ord;
