/**
 * LiveKit Cloud.
 *
 * Cloud rather than a self-hosted SFU so rooms keep working when the ASUS is
 * asleep, and so audio does not have to cross the Cloudflare tunnel, which
 * carries HTTP but not the UDP media path WebRTC needs.
 *
 * The API secret stays on the server. The browser only ever receives a
 * short-lived join token scoped to one room and one identity, so a leaked
 * token buys an hour in a single room rather than the account.
 */
import { AccessToken, RoomServiceClient, TrackSource } from 'livekit-server-sdk';

/**
 * Audio only, and only when on stage.
 *
 * This must be the SDK's enum, not the string 'microphone': the string throws
 * inside toJwt(), which is a long way from where it was written.
 */
const MIC_ONLY = [TrackSource.MICROPHONE];

const URL_WS = process.env.LIVEKIT_URL || '';
const KEY = process.env.LIVEKIT_API_KEY || '';
const SECRET = process.env.LIVEKIT_API_SECRET || '';

export const livekitReady = Boolean(URL_WS && KEY && SECRET);

/** The REST endpoint is the websocket URL over https. */
const httpUrl = URL_WS.replace(/^ws/, 'http');

const svc = livekitReady ? new RoomServiceClient(httpUrl, KEY, SECRET) : null;

/**
 * A join token.
 *
 * `canPublish` is the whole difference between being on stage and being in the
 * audience, and it is decided here from the database role rather than from
 * anything the client claims. Listeners cannot open a microphone even if they
 * patch the UI.
 */
export async function joinToken({ room, identity, name, canPublish }) {
  const at = new AccessToken(KEY, SECRET, {
    identity,
    name,
    // Long enough for a room to be worth joining, short enough that a leaked
    // token is not a standing invitation.
    ttl: '2h',
  });
  at.addGrant({
    room,
    roomJoin: true,
    canSubscribe: true,
    canPublish: !!canPublish,
    // Nobody needs to publish video: this is an audio product, and allowing
    // camera by accident would be a nasty surprise in a members' club.
    canPublishData: true,
    canPublishSources: canPublish ? MIC_ONLY : [],
  });
  return at.toJwt();
}

/**
 * Changes what a participant may do without making them rejoin.
 *
 * Reconnecting to change a permission would drop the audio for a beat and lose
 * their place in the conversation, which is exactly the moment someone is
 * being brought up to speak.
 */
export async function setCanPublish(room, identity, canPublish) {
  if (!svc) return;
  try {
    await svc.updateParticipant(room, identity, undefined, {
      canSubscribe: true,
      canPublish,
      canPublishData: true,
      canPublishSources: canPublish ? MIC_ONLY : [],
    });
  } catch (e) {
    // Not being in the LiveKit room yet is normal: the database is the record
    // of who may speak, and the grant is applied when they connect.
    if (!/not found/i.test(e.message || '')) {
      console.error('[livekit] updateParticipant', e.message);
    }
  }
}

/** Removes someone from the audio room. The database row is handled by caller. */
export async function evict(room, identity) {
  if (!svc) return;
  try {
    await svc.removeParticipant(room, identity);
  } catch { /* already gone */ }
}
