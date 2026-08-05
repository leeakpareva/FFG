-- room_state returned listeners and hands_raised as strings.
--
-- count() is bigint, node-pg hands bigint back as a string to avoid losing
-- precision past 2^53, and bigint + integer is still bigint. So `listeners`
-- arrived in JSON as "142" and any arithmetic on it silently concatenated:
-- 142 + 1 came out as "1421".
--
-- A room will never hold two billion people, so casting to int is safe and
-- puts the fix where the value is produced rather than in every caller.

-- CREATE OR REPLACE cannot change a column's type, so the view has to go
-- first. Nothing depends on it but the API, and it holds no data.
DROP VIEW IF EXISTS room_state;

CREATE VIEW room_state AS
SELECT r.id, r.title, r.description, r.tag, r.is_live, r.scheduled_for,
       (r.base_listeners + count(p.member_id))::int AS listeners,
       (count(p.member_id) FILTER (WHERE p.hand_raised))::int AS hands_raised
FROM rooms r
LEFT JOIN room_participants p ON p.room_id = r.id
GROUP BY r.id;
