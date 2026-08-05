/**
 * A test participant that joins a room and talks.
 *
 * Rooms are hard to test alone: you can see your own microphone light up, but
 * you cannot tell whether anyone would actually hear you, and you cannot tell
 * whether you would hear them. This joins as a real member and plays an
 * audible tone, so one person with one device can confirm both directions.
 *
 *   node tests/test-speaker.mjs                     # waits to be invited up
 *   node tests/test-speaker.mjs fundraising 60 now  # walks straight on stage
 *
 * The default makes you invite it, which exercises the hand queue. Pass "now"
 * and it uses the admin account to invite itself, so you only have to listen:
 * if you hear the chime, receiving audio works and the only remaining question
 * is your own microphone.
 *
 * Needs CLERK_SECRET_KEY. It signs in as a throwaway member, so it appears in
 * the room like anybody else and is cleaned up on exit.
 *
 * Cleanup runs on normal exit and on Ctrl-C, but a hard kill skips it and
 * leaves the account behind. Test accounts all use @example.com, so sweep any
 * strays with:
 *
 *   node tests/prune-test-accounts.mjs
 */
import { Room, AudioSource, LocalAudioTrack, TrackPublishOptions, TrackSource, AudioFrame } from '@livekit/rtc-node';

const API = (process.env.API || 'https://api-connect.navada-edge-server.uk').replace(/\/$/, '');
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const ROOM = process.argv[2] || 'fundraising';
const SECONDS = Number(process.argv[3] || 60);
const SELF_INVITE = process.argv[4] === 'now';
const ADMIN_CLERK_ID = process.env.ADMIN_CLERK_ID || 'user_3AimNiCuzQ3LL2dTnQ5lIH5K3kJ';

if (!CLERK_SECRET) {
  console.error('CLERK_SECRET_KEY is required.');
  process.exit(2);
}

const clerk = (path, init = {}) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${CLERK_SECRET}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  });

const SAMPLE_RATE = 48000;
const CHANNELS = 1;

/** 10ms of a gentle two-tone chime, so it is obviously a person-ish sound. */
function* tone(freqA, freqB) {
  const samplesPer10ms = SAMPLE_RATE / 100;
  let t = 0;
  while (true) {
    const buf = new Int16Array(samplesPer10ms);
    // Warble between two notes about twice a second: steady enough to
    // recognise, varied enough that you can tell it is still running.
    const f = Math.floor(t / (SAMPLE_RATE / 2)) % 2 ? freqB : freqA;
    for (let i = 0; i < samplesPer10ms; i++, t++) {
      buf[i] = Math.round(Math.sin((2 * Math.PI * f * t) / SAMPLE_RATE) * 9000);
    }
    yield new AudioFrame(buf, SAMPLE_RATE, CHANNELS, samplesPer10ms);
  }
}

let cleanup = async () => {};

async function main() {
  // A throwaway account, so the bot shows up as a real member in the room.
  const stamp = Date.now();
  const user = await (await clerk('/users', {
    method: 'POST',
    body: JSON.stringify({
      email_address: [`roomtest-${stamp}@example.com`],
      first_name: 'Room', last_name: 'Test',
      password: `RoomTest-${stamp}-Pw!`,
    }),
  })).json();
  if (!user.id) throw new Error(`could not create test user: ${JSON.stringify(user)}`);

  const sess = await (await clerk('/sessions', {
    method: 'POST', body: JSON.stringify({ user_id: user.id }),
  })).json();
  const { jwt } = await (await clerk(`/sessions/${sess.id}/tokens`, { method: 'POST' })).json();

  const authed = (path, method = 'POST') =>
    fetch(`${API}/api/rooms/${ROOM}${path}`, { method, headers: { Authorization: `Bearer ${jwt}` } });

  const me = await (await fetch(`${API}/api/me`, { headers: { Authorization: `Bearer ${jwt}` } })).json();
  console.log(`joining "${ROOM}" as ${me.name} (${me.id})`);

  const seat = await (await authed('/join')).json();
  if (!seat.audio) throw new Error(`no audio on this server: ${seat.detail || ''}`);
  console.log(`seat: role=${seat.role}`);

  // A newcomer lands in the audience with no microphone, which is the point of
  // the design. Raise a hand so you can practise inviting someone up.
  // Connect BEFORE asking to be promoted. The server grants the microphone by
  // updating the live participant, so it has to find one: promoting first and
  // connecting after arrives holding a listener's token.
  const room = new Room();
  await room.connect(seat.url, seat.token, { autoSubscribe: true, dynacast: true });
  console.log('connected to LiveKit');

  let adminSession = null;
  if (seat.role !== 'speaker') {
    await authed('/hand');

    if (SELF_INVITE) {
      // Borrow the admin account to do what a moderator would do. Same
      // endpoint, same permission check: nothing here bypasses the rules.
      adminSession = await (await clerk('/sessions', {
        method: 'POST', body: JSON.stringify({ user_id: ADMIN_CLERK_ID }),
      })).json();
      const adminJwt = (await (await clerk(`/sessions/${adminSession.id}/tokens`, { method: 'POST' })).json()).jwt;
      await fetch(`${API}/api/rooms/${ROOM}/join`, { method: 'POST', headers: { Authorization: `Bearer ${adminJwt}` } });
      const up = await fetch(`${API}/api/rooms/${ROOM}/speakers/${me.id}`, {
        method: 'POST', headers: { Authorization: `Bearer ${adminJwt}` },
      });
      console.log(up.ok ? 'invited itself up using the admin account' : `could not self-invite: ${up.status}`);
      await fetch(`${API}/api/rooms/${ROOM}/leave`, { method: 'POST', headers: { Authorization: `Bearer ${adminJwt}` } });
    } else {
      console.log('\n  This test member is in the AUDIENCE with a hand raised.');
      console.log('  In the app you should see "1 person wants to speak". Tap "Invite up".');
      console.log('  The tone starts as soon as you do.\n');
    }
  }

  const source = new AudioSource(SAMPLE_RATE, CHANNELS);
  const track = LocalAudioTrack.createAudioTrack('test-voice', source);
  const opts = new TrackPublishOptions();
  opts.source = TrackSource.SOURCE_MICROPHONE;

  // Try to publish rather than asking whether we may. The client's cached
  // permissions lag the server's grant, so asking says no long after the
  // answer is yes; attempting is the only reliable test.
  const deadline = Date.now() + SECONDS * 1000;
  let published = false;
  while (Date.now() < deadline && !published) {
    try {
      await room.localParticipant.publishTrack(track, opts);
      published = true;
      console.log('PUBLISHING — you should hear a chime in the room now.');
    } catch {
      await new Promise(r => setTimeout(r, 1500));
    }
  }

  if (!published) {
    console.log('Never got permission to speak, so nothing was played.');
  } else {
    const chime = tone(440, 587);
    while (Date.now() < deadline) {
      await source.captureFrame(chime.next().value);
    }
  }

  cleanup = async () => {
    try { await room.disconnect(); } catch { /* already gone */ }
    await authed('/leave').catch(() => {});
    await clerk(`/sessions/${sess.id}/revoke`, { method: 'POST' }).catch(() => {});
    if (adminSession?.id) await clerk(`/sessions/${adminSession.id}/revoke`, { method: 'POST' }).catch(() => {});
    await clerk(`/users/${user.id}`, { method: 'DELETE' }).catch(() => {});
    console.log('left the room and cleaned up the test account.');
  };
  await cleanup();
}

process.on('SIGINT', async () => { await cleanup(); process.exit(0); });

main()
  .then(() => process.exit(0))
  .catch(async (e) => { console.error('FAILED:', e.message); await cleanup(); process.exit(1); });
