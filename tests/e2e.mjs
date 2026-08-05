/**
 * Connect — end-to-end API tests.
 *
 * Runs against a deployed API, by default the public one the Vercel build
 * calls. Every request goes over the same path a browser takes, including the
 * Origin header, so a CORS regression fails the suite rather than only showing
 * up in someone's browser.
 *
 * Clerk sessions are minted through the backend API and revoked afterwards.
 * Rows and files the tests create are removed in teardown.
 *
 *   node tests/e2e.mjs
 *   API=http://localhost:8110 node tests/e2e.mjs
 *
 * Requires CLERK_SECRET_KEY in the environment.
 */
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync } from 'node:fs';

const API = (process.env.API || 'https://api-connect.navada-edge-server.uk').replace(/\/$/, '');
const ORIGIN = process.env.ORIGIN || 'https://ffg-app.vercel.app';
const CLERK_SECRET = process.env.CLERK_SECRET_KEY;
const ADMIN_CLERK_ID = process.env.ADMIN_CLERK_ID || 'user_3AimNiCuzQ3LL2dTnQ5lIH5K3kJ';

if (!CLERK_SECRET) {
  console.error('CLERK_SECRET_KEY is required.');
  process.exit(2);
}

/* ------------------------------------------------------------------ runner */

const results = [];
let group = '';

const G = (name) => { group = name; };

async function test(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ group, name, ok: true, ms: Date.now() - started });
    console.log(`  PASS  ${name}`);
  } catch (e) {
    results.push({ group, name, ok: false, ms: Date.now() - started, error: e.message });
    console.log(`  FAIL  ${name}\n        ${e.message}`);
  }
}

function expect(actual, wanted, what) {
  if (actual !== wanted) throw new Error(`${what}: expected ${wanted}, got ${actual}`);
}

function expectTruthy(v, what) {
  if (!v) throw new Error(`${what}: expected a value, got ${JSON.stringify(v)}`);
}

/* ------------------------------------------------------------------- clerk */

const clerk = (path, init = {}) =>
  fetch(`https://api.clerk.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${CLERK_SECRET}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

async function mintToken(userId) {
  const s = await (await clerk('/sessions', {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  })).json();
  if (!s.id) throw new Error(`could not create session: ${JSON.stringify(s)}`);
  const t = await (await clerk(`/sessions/${s.id}/tokens`, { method: 'POST' })).json();
  return { sessionId: s.id, jwt: t.jwt };
}

const revoke = (sessionId) => clerk(`/sessions/${sessionId}/revoke`, { method: 'POST' });

/* --------------------------------------------------------------- API calls */

const call = (path, { token, method = 'GET', body, origin = ORIGIN, raw } = {}) => {
  const headers = { Origin: origin };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body && !raw) headers['Content-Type'] = 'application/json';
  return fetch(`${API}${path}`, {
    method,
    headers,
    body: raw ? body : body ? JSON.stringify(body) : undefined,
  });
};

/** A 1x1 PNG, small enough to keep the suite fast. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAKUlEQVR4nGP8//8/AzpgYmBgYGRkxJBg' +
  'YmBgYGJAA6MaRjWMahjVAAQAAP//RiwCEfSnpXAAAAAASUVORK5CYII=',
  'base64'
);

function imageForm(bytes, { name = 'x.png', type = 'image/png', kind = 'post', alt } = {}) {
  const form = new FormData();
  form.append('file', new Blob([bytes], { type }), name);
  form.append('kind', kind);
  if (alt) form.append('alt_text', alt);
  return form;
}

/* -------------------------------------------------------------------- main */

const created = { clerkUsers: [], sessions: [], mediaIds: [], articleIds: [] };

async function main() {
  console.log(`Connect E2E — ${API}\n`);

  const admin = await mintToken(ADMIN_CLERK_ID);
  created.sessions.push(admin.sessionId);

  /* --- 1. service health -------------------------------------------- */
  G('Service');
  await test('health endpoint is up and the database is reachable', async () => {
    const r = await call('/api/health');
    expect(r.status, 200, 'status');
    const b = await r.json();
    expect(b.ok, true, 'ok');
    expect(b.db, 'up', 'db');
  });

  await test('unknown route returns 404 JSON, not an HTML error page', async () => {
    const r = await call('/api/nope');
    expect(r.status, 404, 'status');
    expect((await r.json()).error, 'not found', 'body');
  });

  /* --- 2. authentication -------------------------------------------- */
  G('Authentication');
  await test('no token is rejected', async () => {
    expect((await call('/api/me')).status, 401, 'status');
  });

  await test('a garbage token is rejected', async () => {
    expect((await call('/api/me', { token: 'not.a.jwt' })).status, 401, 'status');
  });

  await test('a revoked session cannot keep using the API', async () => {
    const tmp = await mintToken(ADMIN_CLERK_ID);
    await revoke(tmp.sessionId);
    // Clerk tokens are short-lived; a revoked session must not mint a new one.
    const r = await clerk(`/sessions/${tmp.sessionId}/tokens`, { method: 'POST' });
    if (r.ok) throw new Error('revoked session still issued a token');
  });

  /* --- 3. CORS ------------------------------------------------------- */
  G('CORS');
  await test('the Vercel origin is allowed', async () => {
    const r = await call('/api/health', { origin: 'https://ffg-app.vercel.app' });
    expect(r.headers.get('access-control-allow-origin'), 'https://ffg-app.vercel.app', 'allow-origin');
  });

  await test('the tunnel origin is allowed', async () => {
    const r = await call('/api/health', { origin: 'https://connect.navada-edge-server.uk' });
    expect(r.headers.get('access-control-allow-origin'), 'https://connect.navada-edge-server.uk', 'allow-origin');
  });

  await test('an unknown origin gets no CORS grant', async () => {
    const r = await call('/api/health', { origin: 'https://evil.example.com' });
    expect(r.headers.get('access-control-allow-origin'), null, 'allow-origin');
  });

  await test('PATCH is allowed through preflight', async () => {
    const r = await fetch(`${API}/api/me`, {
      method: 'OPTIONS',
      headers: {
        Origin: ORIGIN,
        'Access-Control-Request-Method': 'PATCH',
        'Access-Control-Request-Headers': 'authorization,content-type',
      },
    });
    expect(r.status, 204, 'status');
    if (!(r.headers.get('access-control-allow-methods') || '').includes('PATCH')) {
      throw new Error('PATCH missing from allow-methods');
    }
  });

  await test('credentials are never allowed (auth rides a header, not a cookie)', async () => {
    const r = await call('/api/health');
    expect(r.headers.get('access-control-allow-credentials'), null, 'allow-credentials');
  });

  /* --- 4. open registration ------------------------------------------ */
  G('Registration');
  let guest;
  await test('a brand new account becomes a member on first call', async () => {
    const email = `e2e-${Date.now()}@example.com`;
    const u = await (await clerk('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email],
        first_name: 'Test',
        last_name: 'Member',
        password: `E2e-${Date.now()}-Pw!`,
      }),
    })).json();
    if (!u.id) throw new Error(`could not create Clerk user: ${JSON.stringify(u)}`);
    created.clerkUsers.push(u.id);

    guest = await mintToken(u.id);
    created.sessions.push(guest.sessionId);

    const r = await call('/api/me', { token: guest.jwt });
    expect(r.status, 200, 'status');
    const me = await r.json();
    expectTruthy(me.id, 'member id');
    expect(me.is_admin, false, 'new members must not be admins');
  });

  await test('the same account resolves to the same member on a second call', async () => {
    const a = await (await call('/api/me', { token: guest.jwt })).json();
    const b = await (await call('/api/me', { token: guest.jwt })).json();
    expect(a.id, b.id, 'member id is stable');
  });

  /* --- 5. profile ---------------------------------------------------- */
  G('Profile');
  await test('a member can read their own profile', async () => {
    const r = await call('/api/me', { token: admin.jwt });
    expect(r.status, 200, 'status');
    const me = await r.json();
    expect(me.id, 'LA', 'member id');
    expect(me.is_admin, true, 'Lee is the admin');
  });

  await test('a member can edit name, role, bio and pillar', async () => {
    const r = await call('/api/me', {
      token: admin.jwt, method: 'PATCH',
      body: { name: 'Leslie A.', role: 'Founder - NAVADA', bio: 'E2E run.', pillar: 'Capital' },
    });
    expect(r.status, 200, 'status');
    const me = await r.json();
    expect(me.bio, 'E2E run.', 'bio saved');
    expect(me.pillar, 'Capital', 'pillar saved');
  });

  await test('a non-admin can edit their own profile too', async () => {
    const r = await call('/api/me', {
      token: guest.jwt, method: 'PATCH', body: { bio: 'Just joined.' },
    });
    expect(r.status, 200, 'status');
    expect((await r.json()).bio, 'Just joined.', 'bio saved');
  });

  await test('a member cannot make themselves an admin', async () => {
    const before = await (await call('/api/me', { token: guest.jwt })).json();
    expect(before.is_admin, false, 'starts non-admin');
    await call('/api/me', { token: guest.jwt, method: 'PATCH', body: { is_admin: true, bio: 'nice try' } });
    const after = await (await call('/api/me', { token: guest.jwt })).json();
    expect(after.is_admin, false, 'still non-admin');
  });

  await test('a member cannot verify themselves', async () => {
    await call('/api/me', { token: guest.jwt, method: 'PATCH', body: { verified: true, bio: 'x' } });
    expect((await (await call('/api/me', { token: guest.jwt })).json()).verified, false, 'still unverified');
  });

  await test('an invalid pillar is refused', async () => {
    expect((await call('/api/me', { token: admin.jwt, method: 'PATCH', body: { pillar: 'Nonsense' } })).status, 400, 'status');
  });

  await test('an invalid handle is refused', async () => {
    expect((await call('/api/me', { token: admin.jwt, method: 'PATCH', body: { handle: 'Not A Handle!' } })).status, 400, 'status');
  });

  await test('an empty name is refused', async () => {
    expect((await call('/api/me', { token: admin.jwt, method: 'PATCH', body: { name: '  ' } })).status, 400, 'status');
  });

  await test('an empty patch is refused', async () => {
    expect((await call('/api/me', { token: admin.jwt, method: 'PATCH', body: {} })).status, 400, 'status');
  });

  await test('a duplicate handle is refused with 409, not a 500', async () => {
    const r = await call('/api/me', { token: guest.jwt, method: 'PATCH', body: { handle: 'leslie.a' } });
    expect(r.status, 409, 'status');
  });

  await test('malformed JSON is a 400, not a 500', async () => {
    const r = await fetch(`${API}/api/me`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.jwt}`, 'Content-Type': 'application/json', Origin: ORIGIN },
      body: 'definitely not json',
    });
    expect(r.status, 400, 'status');
  });

  /* --- 6. uploads ---------------------------------------------------- */
  G('Image upload');
  let mediaId, mediaUrl;
  await test('a member can upload a PNG', async () => {
    const r = await call('/api/media', {
      token: admin.jwt, method: 'POST', raw: true,
      body: imageForm(PNG, { kind: 'post', alt: 'e2e' }),
    });
    expect(r.status, 201, 'status');
    const m = await r.json();
    expectTruthy(m.id, 'media id');
    expect(m.mime, 'image/png', 'mime');
    mediaId = m.id; mediaUrl = m.url;
    created.mediaIds.push(m.id);
  });

  await test('a non-admin can upload too', async () => {
    const r = await call('/api/media', {
      token: guest.jwt, method: 'POST', raw: true,
      body: imageForm(PNG, { kind: 'avatar', alt: 'e2e guest' }),
    });
    expect(r.status, 201, 'status');
    created.mediaIds.push((await r.json()).id);
  });

  await test('an uploaded image is served back with the right type', async () => {
    const r = await fetch(`${API}${mediaUrl}`);
    expect(r.status, 200, 'status');
    expect(r.headers.get('content-type'), 'image/png', 'content-type');
    expect(r.headers.get('x-content-type-options'), 'nosniff', 'nosniff header');
  });

  await test('uploaded content cannot execute in the page origin', async () => {
    const csp = (await fetch(`${API}${mediaUrl}`)).headers.get('content-security-policy') || '';
    if (!csp.includes("default-src 'none'")) throw new Error(`weak CSP on media: ${csp}`);
  });

  await test('a file that is not an image is refused even if it claims to be', async () => {
    const r = await call('/api/media', {
      token: admin.jwt, method: 'POST', raw: true,
      body: imageForm(Buffer.from('#!/bin/sh\necho hi\n'), { name: 'evil.png', type: 'image/png' }),
    });
    expect(r.status, 415, 'status');
  });

  await test('an oversized file is refused with 413', async () => {
    // 9MB of PNG-prefixed noise: past the 8MB cap, and the cap must bite first.
    const big = Buffer.concat([PNG, Buffer.alloc(9 * 1024 * 1024, 7)]);
    const r = await call('/api/media', {
      token: admin.jwt, method: 'POST', raw: true, body: imageForm(big),
    });
    expect(r.status, 413, 'status');
  });

  await test('uploading without a token is refused', async () => {
    const r = await call('/api/media', { method: 'POST', raw: true, body: imageForm(PNG) });
    expect(r.status, 401, 'status');
  });

  await test('an unknown media path is a 404', async () => {
    expect((await fetch(`${API}/media/post/LA/209901/does-not-exist.png`)).status, 404, 'status');
  });

  /* --- 7. avatars ---------------------------------------------------- */
  G('Profile photo');
  await test('a member can set their profile photo from an upload', async () => {
    const up = await (await call('/api/media', {
      token: admin.jwt, method: 'POST', raw: true,
      body: imageForm(PNG, { kind: 'avatar', alt: 'avatar' }),
    })).json();
    created.mediaIds.push(up.id);

    const r = await call('/api/me', { token: admin.jwt, method: 'PATCH', body: { avatar_media_id: up.id } });
    expect(r.status, 200, 'status');
    expectTruthy((await r.json()).avatar_url, 'avatar_url');
  });

  await test('the photo shows up on the next profile read', async () => {
    expectTruthy((await (await call('/api/me', { token: admin.jwt })).json()).avatar_url, 'avatar_url');
  });

  await test('a member cannot point their avatar at someone else\'s file', async () => {
    const r = await call('/api/me', { token: guest.jwt, method: 'PATCH', body: { avatar_media_id: mediaId } });
    expect(r.status, 400, 'status');
  });

  await test('a member can remove their profile photo', async () => {
    const r = await call('/api/me', { token: admin.jwt, method: 'PATCH', body: { avatar_media_id: null } });
    expect(r.status, 200, 'status');
    expect((await r.json()).avatar_url, null, 'avatar_url cleared');
  });

  /* --- 8. library ---------------------------------------------------- */
  G('Library (Read)');
  await test('any member can list articles', async () => {
    const r = await call('/api/articles', { token: guest.jwt });
    expect(r.status, 200, 'status');
    if (!Array.isArray(await r.json())) throw new Error('expected an array');
  });

  await test('a non-admin cannot publish', async () => {
    const r = await call('/api/articles', {
      token: guest.jwt, method: 'POST',
      body: { id: `e2e-${Date.now()}`, title: 'Nope', body: ['x'], tag: 'Capital' },
    });
    expect(r.status, 403, 'status');
  });

  await test('the admin can publish', async () => {
    const id = `e2e-${Date.now()}`;
    const r = await call('/api/articles', {
      token: admin.jwt, method: 'POST',
      body: { id, title: 'E2E article', excerpt: 'x', body: ['One.', 'Two.'], tag: 'Capital', read_time: '2 min' },
    });
    expect(r.status, 201, 'status');
    created.articleIds.push(id);
  });

  await test('a published article can be read back with its body', async () => {
    const id = created.articleIds[0];
    const r = await call(`/api/articles/${id}`, { token: guest.jwt });
    expect(r.status, 200, 'status');
    const a = await r.json();
    expect(a.body.length, 2, 'paragraph count');
  });

  await test('publishing the same id twice is a 409, not a 500', async () => {
    const id = created.articleIds[0];
    const r = await call('/api/articles', {
      token: admin.jwt, method: 'POST',
      body: { id, title: 'dupe', body: ['x'], tag: 'Capital' },
    });
    expect(r.status, 409, 'status');
  });

  await test('a non-admin cannot delete an article', async () => {
    const r = await call(`/api/articles/${created.articleIds[0]}`, { token: guest.jwt, method: 'DELETE' });
    expect(r.status, 403, 'status');
  });

  /* --- 9. rooms ------------------------------------------------------ */
  G('Rooms');
  const ROOM = 'fundraising';
  const grants = (jwt) => JSON.parse(Buffer.from(jwt.split('.')[1], 'base64url').toString()).video;

  await test('rooms list with live state', async () => {
    const r = await call('/api/rooms', { token: guest.jwt });
    expect(r.status, 200, 'status');
    const rooms = await r.json();
    if (!rooms.find(x => x.id === ROOM)) throw new Error('fundraising room missing');
  });

  await test('an unknown room is a 404', async () => {
    expect((await call('/api/rooms/not-a-room', { token: guest.jwt })).status, 404, 'status');
  });

  let baseline;
  await test('joining puts you in the room and moves the listener count', async () => {
    baseline = (await (await call(`/api/rooms/${ROOM}`, { token: admin.jwt })).json()).listeners;
    const r = await call(`/api/rooms/${ROOM}/join`, { token: guest.jwt, method: 'POST' });
    expect(r.status, 200, 'status');
    const seat = await r.json();
    expect(seat.role, 'listener', 'a new member arrives listening');
    const after = (await (await call(`/api/rooms/${ROOM}`, { token: admin.jwt })).json()).listeners;
    expect(after, baseline + 1, 'listener count');
  });

  await test('a listener is issued a token that cannot open a microphone', async () => {
    const seat = await (await call(`/api/rooms/${ROOM}/join`, { token: guest.jwt, method: 'POST' })).json();
    const g = grants(seat.token);
    expect(g.canPublish, false, 'canPublish');
    expect(g.canSubscribe, true, 'canSubscribe');
    expect(g.room, ROOM, 'token is scoped to one room');
  });

  await test('the admin joins on stage with microphone rights', async () => {
    const seat = await (await call(`/api/rooms/${ROOM}/join`, { token: admin.jwt, method: 'POST' })).json();
    expect(seat.role, 'speaker', 'role');
    expect(grants(seat.token).canPublish, true, 'canPublish');
  });

  await test('raising a hand is recorded', async () => {
    const r = await call(`/api/rooms/${ROOM}/hand`, { token: guest.jwt, method: 'POST', body: { raised: true } });
    expect(r.status, 200, 'status');
    expect((await r.json()).hand_raised, true, 'hand_raised');
  });

  await test('a listener cannot put themselves on stage', async () => {
    const me = await (await call('/api/me', { token: guest.jwt })).json();
    const r = await call(`/api/rooms/${ROOM}/speakers/${me.id}`, { token: guest.jwt, method: 'POST' });
    expect(r.status, 403, 'status');
  });

  await test('a speaker can bring a raised hand up', async () => {
    const me = await (await call('/api/me', { token: guest.jwt })).json();
    const r = await call(`/api/rooms/${ROOM}/speakers/${me.id}`, { token: admin.jwt, method: 'POST' });
    expect(r.status, 200, 'status');
    const them = (await r.json()).participants.find(p => p.id === me.id);
    expect(them.role, 'speaker', 'role');
    expect(them.hand_raised, false, 'hand comes down on the way up');
  });

  await test('once on stage the token grants the microphone', async () => {
    const seat = await (await call(`/api/rooms/${ROOM}/join`, { token: guest.jwt, method: 'POST' })).json();
    expect(seat.role, 'speaker', 'role');
    expect(grants(seat.token).canPublish, true, 'canPublish');
  });

  await test('the admin is a moderator, an invited speaker is not', async () => {
    const seat = await (await call(`/api/rooms/${ROOM}/join`, { token: admin.jwt, method: 'POST' })).json();
    expect(seat.moderator, true, 'admin moderates');
    const guestSeat = await (await call(`/api/rooms/${ROOM}/join`, { token: guest.jwt, method: 'POST' })).json();
    expect(guestSeat.role, 'speaker', 'guest was invited up earlier');
    expect(guestSeat.moderator, false, 'being handed a microphone is not being handed the room');
  });

  await test('an invited speaker cannot invite anyone else up', async () => {
    // A third person, so the invited speaker has someone to try to promote.
    const email = `e2e-${Date.now()}-b@example.com`;
    const u = await (await clerk('/users', {
      method: 'POST',
      body: JSON.stringify({
        email_address: [email], first_name: 'Third', last_name: 'Person',
        password: `E2e-${Date.now()}-Pw!`,
      }),
    })).json();
    created.clerkUsers.push(u.id);
    const third = await mintToken(u.id);
    created.sessions.push(third.sessionId);

    await call(`/api/rooms/${ROOM}/join`, { token: third.jwt, method: 'POST' });
    const them = await (await call('/api/me', { token: third.jwt })).json();

    // guest is a speaker but not a moderator, so this must be refused.
    const r = await call(`/api/rooms/${ROOM}/speakers/${them.id}`, { token: guest.jwt, method: 'POST' });
    expect(r.status, 403, 'status');

    await call(`/api/rooms/${ROOM}/leave`, { token: third.jwt, method: 'POST' });
  });

  await test('stepping down drops moderator too, so the check constraint holds', async () => {
    const me = await (await call('/api/me', { token: admin.jwt })).json();
    await call(`/api/rooms/${ROOM}/speakers/${me.id}`, { token: admin.jwt, method: 'DELETE' });
    const seat = await (await call(`/api/rooms/${ROOM}`, { token: admin.jwt })).json();
    const row = seat.participants.find(p => p.id === me.id);
    expect(row.role, 'listener', 'role');
    expect(row.moderator, false, 'moderator cleared');
  });

  await test('a member can step down from stage themselves', async () => {
    const me = await (await call('/api/me', { token: guest.jwt })).json();
    const r = await call(`/api/rooms/${ROOM}/speakers/${me.id}`, { token: guest.jwt, method: 'DELETE' });
    expect(r.status, 200, 'status');
    expect((await r.json()).participants.find(p => p.id === me.id).role, 'listener', 'role');
  });

  await test('a heartbeat from someone not in the room is refused', async () => {
    const r = await call('/api/rooms/wellness/heartbeat', { token: guest.jwt, method: 'POST' });
    expect(r.status, 409, 'status');
  });

  await test('leaving removes you and the count returns', async () => {
    await call(`/api/rooms/${ROOM}/leave`, { token: guest.jwt, method: 'POST' });
    await call(`/api/rooms/${ROOM}/leave`, { token: admin.jwt, method: 'POST' });
    const after = (await (await call(`/api/rooms/${ROOM}`, { token: admin.jwt })).json()).listeners;
    expect(after, baseline, 'listener count back to baseline');
  });

  await test('rooms require a signed-in member', async () => {
    expect((await call('/api/rooms')).status, 401, 'status');
    expect((await call(`/api/rooms/${ROOM}/join`, { method: 'POST' })).status, 401, 'status');
  });

  /* --- teardown ------------------------------------------------------ */
  await teardown(admin);
  report();
}

/**
 * Removes what the run created.
 *
 * One thing it cannot reach: the `members` row that registration auto-creates
 * for the throwaway Clerk account. There is no API to delete a member — by
 * design, a member should not be able to erase themselves and take their
 * posts with them — so the row outlives the Clerk user. Test accounts all use
 * `@example.com`, so prune them with:
 *
 *   docker exec ffg-postgres psql -U postgres -d ffg \
 *     -c "DELETE FROM members WHERE email LIKE 'e2e-%@example.com';"
 */
async function teardown(admin) {
  for (const id of created.articleIds) {
    await call(`/api/articles/${id}`, { token: admin.jwt, method: 'DELETE' }).catch(() => {});
  }
  for (const id of created.clerkUsers) {
    await clerk(`/users/${id}`, { method: 'DELETE' }).catch(() => {});
  }
  for (const s of created.sessions) await revoke(s).catch(() => {});
  console.log('\nNote: the throwaway member row is left behind — see teardown() for the prune query.');
  await sleep(50);
}

function report() {
  const pass = results.filter(r => r.ok).length;
  const fail = results.length - pass;
  console.log(`\n${pass}/${results.length} passed${fail ? `, ${fail} FAILED` : ''}`);
  if (process.env.JSON_OUT) {
    writeFileSync(process.env.JSON_OUT, JSON.stringify(results, null, 2));
  }
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(2); });
