-- Real counts only.
--
-- base_listeners was demo padding: a seeded number so the mockup looked busy.
-- Now that people are actually in these rooms it is a lie, and a headline
-- "143 here" next to two real faces is worse than an honest "2 here".
--
-- The column is left in place rather than dropped so nothing that still reads
-- it breaks, but nothing should: the view no longer adds it.

DROP VIEW IF EXISTS room_state;

CREATE VIEW room_state AS
SELECT r.id, r.title, r.description, r.tag, r.is_live, r.scheduled_for,
       count(p.member_id)::int AS listeners,
       (count(p.member_id) FILTER (WHERE p.hand_raised))::int AS hands_raised,
       (count(p.member_id) FILTER (WHERE p.role = 'speaker'))::int AS speaking
FROM rooms r
LEFT JOIN room_participants p ON p.room_id = r.id
GROUP BY r.id;

-- Nobody is in any room right now, and the seeded numbers should not come
-- back the next time someone reads the column.
UPDATE rooms SET base_listeners = 0;
