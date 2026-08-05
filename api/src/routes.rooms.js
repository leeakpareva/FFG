/**
 * Rooms: live audio, Clubhouse style.
 *
 * Postgres is the record of who is in a room and who may speak; LiveKit only
 * carries the audio. That split matters because the listener count, the hand
 * queue and the stage list have to survive a dropped websocket, and because
 * permission has to be decided somewhere the client cannot reach.
 *
 * Presence is a row that exists only while you are in the room. Leaving
 * deletes it, and a sweeper reaps rows whose browser closed without saying
 * goodbye, so the counts stay honest rather than drifting upward forever.
 */
import { Router } from 'express';
import { q } from './db.js';
import { requireMember } from './auth.js';
import { joinToken, setCanPublish, evict, livekitReady } from './livekit.js';
import { track } from './track.js';

export const roomsRouter = Router();

/** A participant is considered gone if their browser has not checked in. */
const STALE = "90 seconds";

const reap = () =>
  q(`DELETE FROM room_participants WHERE last_seen_at < now() - interval '${STALE}'`);

/** Everyone in a room, speakers first, with the raised hands last in queue order. */
async function participants(roomId) {
  const { rows } = await q(
    `SELECT p.member_id, p.role, p.moderator, p.hand_raised, p.muted, p.joined_at,
            m.name, m.handle, av.storage_key AS avatar_key
       FROM room_participants p
       JOIN members m ON m.id = p.member_id
       LEFT JOIN media av ON av.id = m.avatar_media_id
      WHERE p.room_id = $1
      ORDER BY p.moderator DESC, (p.role = 'speaker') DESC, p.joined_at`,
    [roomId]
  );
  return rows.map(r => ({
    id: r.member_id,
    name: r.name,
    handle: r.handle,
    role: r.role,
    moderator: r.moderator,
    hand_raised: r.hand_raised,
    muted: r.muted,
    avatar_url: r.avatar_key ? `/media/${r.avatar_key}` : null,
  }));
}

/** Seeded stage list, used when nobody has joined live yet. */
async function billedSpeakers(roomId) {
  const { rows } = await q(
    `SELECT s.member_id, m.name FROM room_speakers s
       JOIN members m ON m.id = s.member_id
      WHERE s.room_id = $1 ORDER BY s.ord`,
    [roomId]
  );
  return rows.map(r => ({ id: r.member_id, name: r.name }));
}

/**
 * May this member run the room?
 *
 * Moderators and admins only. A speaker who was invited up cannot then invite
 * anyone else, which is the Clubhouse rule and the point of the distinction:
 * handing someone a microphone is not the same as handing them the room.
 */
async function canModerate(roomId, member) {
  if (member.is_admin) return true;
  const { rows } = await q(
    `SELECT 1 FROM room_participants
      WHERE room_id = $1 AND member_id = $2 AND moderator`,
    [roomId, member.id]
  );
  return !!rows[0];
}

/* ------------------------------------------------------------------ listing */

roomsRouter.get('/', requireMember, async (_req, res) => {
  await reap();
  const { rows } = await q(
    `SELECT id, title, description, tag, is_live, scheduled_for, listeners, hands_raised
       FROM room_state ORDER BY is_live DESC, listeners DESC`
  );
  const out = [];
  for (const r of rows) {
    out.push({ ...r, speakers: await billedSpeakers(r.id) });
  }
  res.json(out);
});

roomsRouter.get('/:id', requireMember, async (req, res) => {
  await reap();
  const { rows } = await q('SELECT * FROM room_state WHERE id = $1', [req.params.id]);
  if (!rows[0]) return res.status(404).json({ error: 'no such room' });
  res.json({
    ...rows[0],
    speakers: await billedSpeakers(req.params.id),
    participants: await participants(req.params.id),
  });
});

/* --------------------------------------------------------------------- join */

roomsRouter.post('/:id/join', requireMember, async (req, res) => {
  const roomId = req.params.id;
  const me = req.member;

  const room = await q('SELECT id FROM rooms WHERE id = $1', [roomId]);
  if (!room.rows[0]) return res.status(404).json({ error: 'no such room' });

  await reap();

  // The people billed to run the session walk straight on as moderators;
  // everyone else arrives listening, muted, exactly as Clubhouse does it.
  const billed = await q(
    'SELECT 1 FROM room_speakers WHERE room_id = $1 AND member_id = $2',
    [roomId, me.id]
  );
  const runsRoom = Boolean(billed.rows[0]) || me.is_admin;

  // On rejoin, someone entitled to run the room must be restored to the stage.
  // Only updating last_seen_at meant a stale listener row from an earlier
  // visit pinned them in the audience for good, with no way back up and no
  // microphone button to explain it.
  //
  // Coming back is never a demotion: a listener who was brought up mid-session
  // keeps the stage, and a moderator keeps moderating.
  const { rows } = await q(
    `INSERT INTO room_participants (room_id, member_id, role, moderator, muted)
     VALUES ($1, $2, $3, $4, true)
     ON CONFLICT (room_id, member_id) DO UPDATE
       SET last_seen_at = now(),
           role      = CASE WHEN $4 THEN 'speaker'::room_role_t
                            ELSE room_participants.role END,
           moderator = room_participants.moderator OR $4
     RETURNING role, moderator`,
    [roomId, me.id, runsRoom ? 'speaker' : 'listener', runsRoom]
  );
  const { role, moderator } = rows[0];
  track(me.id, 'room_join', { room: roomId, role });

  if (!livekitReady) {
    // The room still works as a place with people in it; only voice is absent.
    return res.status(200).json({
      role, moderator, audio: false,
      detail: 'Audio is not configured on this server.',
      participants: await participants(roomId),
    });
  }

  const token = await joinToken({
    room: roomId,
    identity: me.id,
    name: me.name,
    canPublish: role === 'speaker',
  });

  res.json({
    role,
    moderator,
    audio: true,
    url: process.env.LIVEKIT_URL,
    token,
    participants: await participants(roomId),
  });
});

roomsRouter.post('/:id/leave', requireMember, async (req, res) => {
  await q('DELETE FROM room_participants WHERE room_id = $1 AND member_id = $2',
    [req.params.id, req.member.id]);
  await evict(req.params.id, req.member.id);
  track(req.member.id, 'room_leave', { room: req.params.id });
  res.status(204).end();
});

/** Keeps presence alive. The client calls this while the room is open. */
roomsRouter.post('/:id/heartbeat', requireMember, async (req, res) => {
  const { rowCount } = await q(
    `UPDATE room_participants SET last_seen_at = now()
      WHERE room_id = $1 AND member_id = $2`,
    [req.params.id, req.member.id]
  );
  if (!rowCount) return res.status(409).json({ error: 'not in this room' });
  await reap();
  res.json({ participants: await participants(req.params.id) });
});

/* -------------------------------------------------------------------- stage */

/** Ask to speak, or put your hand back down. */
roomsRouter.post('/:id/hand', requireMember, async (req, res) => {
  const raised = req.body?.raised !== false;
  const { rowCount } = await q(
    `UPDATE room_participants SET hand_raised = $3, last_seen_at = now()
      WHERE room_id = $1 AND member_id = $2`,
    [req.params.id, req.member.id, raised]
  );
  if (!rowCount) return res.status(409).json({ error: 'join the room first' });
  res.json({ hand_raised: raised, participants: await participants(req.params.id) });
});

/** Bring someone up. Moderators only; the caller cannot promote themselves. */
roomsRouter.post('/:id/speakers/:memberId', requireMember, async (req, res) => {
  const { id: roomId, memberId } = req.params;
  if (!(await canModerate(roomId, req.member))) {
    return res.status(403).json({ error: 'only speakers can bring someone on stage' });
  }

  const { rowCount } = await q(
    `UPDATE room_participants
        SET role = 'speaker', hand_raised = false, muted = true
      WHERE room_id = $1 AND member_id = $2`,
    [roomId, memberId]
  );
  if (!rowCount) return res.status(404).json({ error: 'they are not in the room' });

  // Grant the microphone without making them reconnect.
  await setCanPublish(roomId, memberId, true);
  res.json({ participants: await participants(roomId) });
});

/** Step down, or be stepped down. You may always remove yourself. */
roomsRouter.delete('/:id/speakers/:memberId', requireMember, async (req, res) => {
  const { id: roomId, memberId } = req.params;
  const self = memberId === req.member.id;
  if (!self && !(await canModerate(roomId, req.member))) {
    return res.status(403).json({ error: 'only speakers can move someone off stage' });
  }

  // Moderator has to come off with the stage role: the check constraint says a
  // moderator is always on stage, and someone who steps down has stepped down.
  const { rowCount } = await q(
    `UPDATE room_participants
        SET role = 'listener', moderator = false, muted = true
      WHERE room_id = $1 AND member_id = $2`,
    [roomId, memberId]
  );
  if (!rowCount) return res.status(404).json({ error: 'they are not in the room' });

  await setCanPublish(roomId, memberId, false);
  res.json({ participants: await participants(roomId) });
});

/** Mute state is cosmetic for other viewers; LiveKit is the real mute. */
roomsRouter.post('/:id/mute', requireMember, async (req, res) => {
  const muted = req.body?.muted !== false;
  await q(
    `UPDATE room_participants SET muted = $3, last_seen_at = now()
      WHERE room_id = $1 AND member_id = $2`,
    [req.params.id, req.member.id, muted]
  );
  res.json({ muted });
});
