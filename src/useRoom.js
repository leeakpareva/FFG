/**
 * Live audio room.
 *
 * Two things are going on at once and they are deliberately kept apart:
 *
 *   Postgres, through our API, is the record of who is in the room and who is
 *   allowed to speak. It survives a dropped websocket and it is the thing a
 *   client cannot lie to.
 *
 *   LiveKit carries the voices. It is told what to allow by the token our API
 *   mints, so a listener cannot open a microphone by editing the page.
 *
 * The hook joins both, keeps presence warm with a heartbeat, and tears
 * everything down on the way out.
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { createApi } from "./api.js";

/** How often we tell the server we are still here. Server reaps after 90s. */
const HEARTBEAT_MS = 30_000;

export function useRoom(roomId, getToken, myId) {
  const [status, setStatus] = useState("idle"); // idle | joining | live | error
  const [role, setRole] = useState("listener");
  const [moderator, setModerator] = useState(false);
  /** What LiveKit currently allows, which can lag what the database says. */
  const [canSpeak, setCanSpeak] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [speaking, setSpeaking] = useState([]);
  const [error, setError] = useState(null);
  const [audioBlocked, setAudioBlocked] = useState(false);

  const lkRef = useRef(null);
  const apiRef = useRef(null);
  if (!apiRef.current) apiRef.current = createApi(getToken);

  const authed = useCallback(async (path, method = "POST", body) => {
    const token = await getToken();
    const base = (import.meta.env.VITE_API_BASE || "").replace(/\/$/, "");
    const res = await fetch(`${base}/api/rooms/${roomId}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.detail || json.error || `Request failed (${res.status})`);
    return json;
  }, [roomId, getToken]);

  /* --------------------------------------------------------------- join */

  const join = useCallback(async () => {
    setStatus("joining");
    setError(null);
    try {
      const seat = await authed("/join");
      setRole(seat.role);
      setModerator(!!seat.moderator);
      setParticipants(seat.participants || []);

      if (!seat.audio) {
        // The room is still a real place with real people; only voice is off.
        setStatus("live");
        return;
      }

      const lk = new Room({ adaptiveStream: true, dynacast: true });
      lkRef.current = lk;

      lk.on(RoomEvent.TrackSubscribed, (track) => {
        if (track.kind !== Track.Kind.Audio) return;
        // Attaching to a detached element is enough for the browser to play it;
        // keeping the reference on the track lets LiveKit clean it up.
        const el = track.attach();
        el.style.display = "none";
        document.body.appendChild(el);
      });

      lk.on(RoomEvent.TrackUnsubscribed, (track) => {
        track.detach().forEach((el) => el.remove());
      });

      lk.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
        setSpeaking(speakers.map((s) => s.identity));
      });

      lk.on(RoomEvent.Disconnected, () => setStatus("idle"));

      // The server grants the microphone by updating the live participant, so
      // being brought on stage arrives here as a permission change rather than
      // anything we asked for.
      lk.on(RoomEvent.ParticipantPermissionsChanged, () => {
        setCanSpeak(!!lk.localParticipant?.permissions?.canPublish);
      });

      await lk.connect(seat.url, seat.token);

      // Browsers refuse to play audio until the page has been interacted with.
      // Joining is a click, so this normally succeeds; when it does not we
      // surface a button rather than sitting in silence.
      try {
        await lk.startAudio();
      } catch {
        setAudioBlocked(true);
      }

      // On stage but muted: nobody should be broadcast without choosing to.
      // Deliberately not awaited into the join path — failing to pre-mute must
      // never stop someone entering the room, and we start muted regardless.
      if (seat.role === "speaker") {
        lk.localParticipant.setMicrophoneEnabled(false).catch(() => {});
      }

      setCanSpeak(!!lk.localParticipant?.permissions?.canPublish);
      setStatus("live");
    } catch (e) {
      setError(e.message || "Could not join the room.");
      setStatus("error");
    }
  }, [authed]);

  /* -------------------------------------------------------------- leave */

  const leave = useCallback(async () => {
    const lk = lkRef.current;
    lkRef.current = null;
    if (lk) { try { await lk.disconnect(); } catch { /* already gone */ } }
    try { await authed("/leave"); } catch { /* the reaper will catch it */ }
    setStatus("idle");
    setMicOn(false);
    setHandRaised(false);
  }, [authed]);

  /* ------------------------------------------------------------ actions */

  const raiseHand = useCallback(async (raised) => {
    const r = await authed("/hand", "POST", { raised });
    setHandRaised(r.hand_raised);
    setParticipants(r.participants || []);
  }, [authed]);

  /**
   * Turn the microphone on or off.
   *
   * This is the one control that reaches outside the app, into the browser's
   * permission prompt and the operating system's audio devices, so it is the
   * one most likely to fail. Every failure has to say something: a mute button
   * that silently does nothing reads as a broken app, and the person cannot
   * tell that their browser blocked them.
   */
  const toggleMic = useCallback(async () => {
    const lk = lkRef.current;
    if (!lk) {
      setError("You are not connected to the room audio yet. Try rejoining.");
      return;
    }
    const next = !micOn;
    try {
      await lk.localParticipant.setMicrophoneEnabled(next);
      setMicOn(next);
      setError(null);
      authed("/mute", "POST", { muted: !next }).catch(() => {});
    } catch (e) {
      // The browser's names for these are not for showing to people.
      const name = e?.name || "";
      if (name === "NotAllowedError" || /permission|denied/i.test(e?.message || "")) {
        setError("Your browser is blocking the microphone. Allow microphone access for this site, then try again.");
      } else if (name === "NotFoundError") {
        setError("No microphone found. Plug one in or check your device settings.");
      } else if (name === "NotReadableError") {
        setError("Something else is using your microphone. Close it and try again.");
      } else {
        setError(e?.message || "Could not turn your microphone on.");
      }
      setMicOn(false);
    }
  }, [micOn, authed]);

  /** Moderator action: bring a raised hand up to speak. */
  const bringUp = useCallback(async (memberId) => {
    const r = await authed(`/speakers/${memberId}`, "POST");
    setParticipants(r.participants || []);
  }, [authed]);

  /** Step down yourself, or move someone else off stage. */
  const stepDown = useCallback(async (memberId) => {
    const r = await authed(`/speakers/${memberId}`, "DELETE");
    setParticipants(r.participants || []);
  }, [authed]);

  const clearError = useCallback(() => setError(null), []);

  const unblockAudio = useCallback(async () => {
    try {
      await lkRef.current?.startAudio();
      setAudioBlocked(false);
    } catch { /* the browser is still refusing; the button stays */ }
  }, []);

  /* --------------------------------------------------------- heartbeat */

  useEffect(() => {
    if (status !== "live") return;
    const tick = setInterval(() => {
      authed("/heartbeat")
        .then((r) => {
          const people = r.participants || [];
          setParticipants(people);
          // Someone may have brought us up while we were listening. The server
          // has already granted the microphone, so reflecting the new role is
          // all the client has to do.
          const me = people.find((p) => p.id === myId);
          if (me) {
            setRole(me.role);
            setModerator(me.moderator);
            setHandRaised(me.hand_raised);
          }
        })
        .catch(() => {});
    }, HEARTBEAT_MS);
    return () => clearInterval(tick);
  }, [status, authed, myId]);

  /* ---------------------------------------------- promotion takes effect */

  useEffect(() => {
    if (role !== "speaker") setMicOn(false);
  }, [role]);

  /**
   * Reconciles the two sources of truth.
   *
   * Normally the server grants the microphone on the live participant and the
   * permission change arrives over the socket, no reconnect needed. But that
   * only works if we were already connected when the grant was issued. If we
   * were promoted a moment before connecting, we arrive holding a token minted
   * while we were still a listener, and LiveKit believes the token.
   *
   * So: if the database says stage and LiveKit says audience, take a fresh
   * token. Without this the mic button is there and simply never works, which
   * is the worst of both.
   */
  useEffect(() => {
    if (status !== "live" || role !== "speaker" || canSpeak) return;
    let cancelled = false;
    const t = setTimeout(async () => {
      const lk = lkRef.current;
      if (!lk || cancelled) return;
      if (lk.localParticipant?.permissions?.canPublish) return;
      try {
        const seat = await authed("/join");
        if (cancelled || !seat.token) return;
        await lk.disconnect();
        await lk.connect(seat.url, seat.token);
        setCanSpeak(!!lk.localParticipant?.permissions?.canPublish);
      } catch {
        setError("You were brought on stage but the microphone did not unlock. Try leaving and rejoining.");
      }
    }, 1500); // let the socket deliver the grant first
    return () => { cancelled = true; clearTimeout(t); };
  }, [status, role, canSpeak, authed]);

  /* ------------------------------------------------------------ cleanup */

  useEffect(() => () => {
    const lk = lkRef.current;
    if (lk) lk.disconnect().catch(() => {});
  }, []);

  return {
    status, role, moderator, canSpeak, participants, handRaised, micOn, speaking, error, audioBlocked,
    join, leave, raiseHand, toggleMic, bringUp, stepDown, unblockAudio, clearError,
    setRole, setParticipants,
  };
}
