-- Moderators.
--
-- Clubhouse has three states in a room, not two: moderator, speaker and
-- listener. A speaker can talk; only a moderator can bring someone up, move
-- someone down, or end the room. Collapsing the two means anyone who is handed
-- the microphone can then hand it to anybody else, which is not what a members
-- club wants.
--
-- The room's billed speakers start as moderators, because they are the people
-- running the session.

ALTER TABLE room_participants
  ADD COLUMN IF NOT EXISTS moderator boolean NOT NULL DEFAULT false;

-- A moderator is always on stage: being able to run the room while invisible
-- to it would be strange, and the UI has nowhere to put them.
ALTER TABLE room_participants
  DROP CONSTRAINT IF EXISTS room_participants_moderator_speaks;
ALTER TABLE room_participants
  ADD CONSTRAINT room_participants_moderator_speaks
  CHECK (NOT moderator OR role = 'speaker');
