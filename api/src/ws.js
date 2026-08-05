/**
 * Real-time. One WebSocket per open app, authenticated with the same Clerk
 * token as every REST call, carrying small typed events:
 *
 *   { type: 'dm',      thread, from }   → you have a new direct message
 *   { type: 'post' }                    → the feed has something new
 *   { type: 'comment', post|article }   → a comment landed
 *   { type: 'follow',  from }           → someone followed you
 *
 * The socket is a doorbell, not a datastore: clients hear the event and
 * refetch through the same REST endpoints they already use. That keeps
 * one source of truth and makes a dropped socket cost staleness measured
 * in seconds (the polls remain as the safety net), never wrongness.
 */
import { WebSocketServer } from 'ws';
import { verifyToken } from '@clerk/backend';
import { q } from './db.js';

const secretKey = process.env.CLERK_SECRET_KEY;

/** memberId -> Set<socket> */
const clients = new Map();

export function setupWs(server) {
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (sock, req) => {
    let memberId = null;
    try {
      const token = new URL(req.url, 'http://x').searchParams.get('token');
      if (!token || !secretKey) throw new Error('no token');
      const claims = await verifyToken(token, { secretKey, clockSkewInMs: 60_000 });
      const { rows } = await q('SELECT id FROM members WHERE clerk_id = $1', [claims.sub]);
      if (!rows[0]) throw new Error('no member');
      memberId = rows[0].id;
    } catch {
      sock.close(4001, 'unauthorized');
      return;
    }

    if (!clients.has(memberId)) clients.set(memberId, new Set());
    clients.get(memberId).add(sock);
    sock.isAlive = true;
    sock.on('pong', () => { sock.isAlive = true; });
    sock.on('close', () => {
      const set = clients.get(memberId);
      if (set) { set.delete(sock); if (!set.size) clients.delete(memberId); }
    });
    sock.send(JSON.stringify({ type: 'hello', id: memberId }));
  });

  // Dead-socket sweep: phones vanish without saying goodbye.
  const sweep = setInterval(() => {
    for (const set of clients.values()) {
      for (const sock of set) {
        if (!sock.isAlive) { sock.terminate(); continue; }
        sock.isAlive = false;
        sock.ping();
      }
    }
  }, 30_000);
  wss.on('close', () => clearInterval(sweep));
  return wss;
}

/**
 * Ring the doorbell. `memberIds` null = everyone connected; an array =
 * just those members. Fire-and-forget — a failed send is a phone that
 * will catch up on its next poll.
 */
export function notify(memberIds, event) {
  const payload = JSON.stringify(event);
  const targets = memberIds === null
    ? [...clients.values()]
    : memberIds.map(id => clients.get(String(id))).filter(Boolean);
  for (const set of targets) {
    for (const sock of set) {
      try { sock.send(payload); } catch { /* the sweep will get them */ }
    }
  }
}
