/**
 * A live room, built the way Clubhouse builds one.
 *
 * The design rules worth stating, because they are what make a room legible:
 *
 *   Three tiers, always in the same order: moderators, then speakers, then the
 *   audience. Position on the screen is the status signal, so nobody has to
 *   read a label to know who is running things.
 *
 *   Everyone arrives muted and listening. Nobody is ever broadcast without
 *   choosing to be, and the room does not get noisier as it gets bigger.
 *
 *   There is exactly one way up: raise your hand, a moderator brings you up.
 *   Both halves of that are visible at all times, so a listener always knows
 *   how to speak and a moderator always knows who is waiting.
 *
 *   Tapping a person is how you act on them. Moderators get the actions;
 *   everyone else gets the profile.
 */
import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Mic, MicOff, Hand, LogOut, Radio, X, ChevronDown, Volume2, Users,
  MessageCircle, Send,
} from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { useRoom } from "./useRoom.js";
import { mediaUrl } from "./api.js";

/* --------------------------------------------------------------- pieces */

/** The green asterisk Clubhouse puts beside a moderator's name. */
const ModMark = ({ T, size = 11 }) => (
  <span style={{ color: T.community, fontSize: size, fontWeight: 900, lineHeight: 1 }}>✳</span>
);

function Face({ T, person, size, speaking, onClick }) {
  const src = person.avatar_url ? mediaUrl(person.avatar_url) : null;
  const onStage = person.role === "speaker";
  return (
    <div onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer" }}>
      <div style={{ position: "relative" }}>
        <div style={{
          width: size, height: size, borderRadius: "50%", overflow: "hidden",
          background: `linear-gradient(135deg, ${T.card}, ${T.ink2})`,
          // A speaking ring is the only moving thing on the screen, so the eye
          // goes straight to whoever has the floor.
          border: `3px solid ${speaking ? T.gold : "transparent"}`,
          boxShadow: speaking ? `0 0 18px ${T.gold}55` : "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontFamily: "'Archivo',sans-serif", fontWeight: 700,
          fontSize: size * 0.33, color: T.cream,
          transition: "border-color 0.12s, box-shadow 0.12s",
        }}>
          {src
            ? <img src={src} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : person.id}
        </div>

        {/* Muted is shown, unmuted is not: a room is mostly silence, and
            badging every quiet person would be noise. */}
        {onStage && person.muted && (
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: size * 0.34, height: size * 0.34, borderRadius: "50%",
            background: T.ink2, border: `2px solid ${T.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><MicOff size={size * 0.18} color={T.dim} /></div>
        )}

        {!onStage && person.hand_raised && (
          <div style={{
            position: "absolute", bottom: -2, right: -2,
            width: size * 0.36, height: size * 0.36, borderRadius: "50%",
            background: T.gold, border: `2px solid ${T.ink}`,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}><Hand size={size * 0.2} color={T.ink} /></div>
        )}
      </div>

      <div style={{ textAlign: "center", lineHeight: 1.25 }}>
        <div style={{ fontSize: size > 60 ? 12.5 : 11, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
          {person.moderator && <><ModMark T={T} /> </>}
          {person.name.split(" ")[0]}
        </div>
      </div>
    </div>
  );
}

/** Tap a person, get the things you are allowed to do to them. */
function PersonSheet({ T, person, me, canModerate, onClose, actions }) {
  const isSelf = person.id === me;
  const onStage = person.role === "speaker";

  const items = [];
  if (canModerate && !onStage) items.push({ label: "Invite to speak", fn: () => actions.bringUp(person.id), primary: true });
  if (canModerate && onStage && !isSelf) items.push({ label: "Move to audience", fn: () => actions.stepDown(person.id) });
  if (isSelf && onStage) items.push({ label: "Leave the stage", fn: () => actions.stepDown(person.id) });
  items.push({ label: "View profile", fn: () => actions.openUser(person.id) });

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 70, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        padding: "20px 18px calc(18px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 18 }}>
          <Face T={T} person={person} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{person.name}</div>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              {person.moderator ? "Moderator" : onStage ? "Speaker" : person.hand_raised ? "Hand raised" : "Listening"}
            </div>
          </div>
          <X size={20} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {items.map((it) => (
          <button key={it.label} onClick={() => { it.fn(); onClose(); }} style={{
            width: "100%", padding: "13px 0", marginBottom: 8, borderRadius: 999, cursor: "pointer",
            background: it.primary ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : "transparent",
            border: it.primary ? "none" : `1px solid ${T.line}`,
            color: it.primary ? T.ink : T.cream,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
          }}>{it.label}</button>
        ))}
      </div>
    </div>
  );
}

const Row = ({ T, label, count }) => (
  <div style={{
    display: "flex", alignItems: "baseline", gap: 8,
    fontSize: 11, letterSpacing: "0.14em", fontWeight: 700,
    fontFamily: "'Inter',sans-serif", color: T.dim, margin: "0 0 14px",
  }}>
    {label}
    <span style={{ color: T.dim, opacity: 0.6, letterSpacing: 0 }}>{count}</span>
  </div>
);

/* ----------------------------------------------------------------- room */

export default function RoomStage({ T, room, profile, onLeave, openUser }) {
  const { getToken } = useAuth();
  const R = useRoom(room.id, getToken, profile?.id);
  const [tapped, setTapped] = useState(null);

  /* The notify: when a NEW hand goes up and you're on stage, a banner
     announces it — the person listening should not have to hope a
     moderator scrolls down. */
  const [handAlert, setHandAlert] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [chatSeen, setChatSeen] = useState(0); // messages read; badge shows the rest
  const chatScrollRef = React.useRef(null);
  useEffect(() => {
    if (chatOpen) {
      setChatSeen(R.chat.length);
      if (chatScrollRef.current) chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatOpen, R.chat.length]);
  const chatUnread = R.chat.length - chatSeen;
  const prevHands = React.useRef(new Set());
  useEffect(() => {
    const now = new Set(R.participants.filter(p => p.hand_raised).map(p => p.id));
    if (R.role === "speaker") {
      for (const id of now) {
        if (!prevHands.current.has(id)) {
          const person = R.participants.find(p => p.id === id);
          if (person && person.id !== profile?.id) setHandAlert(person);
        }
      }
    }
    prevHands.current = now;
  }, [R.participants, R.role, profile?.id]);
  useEffect(() => {
    if (!handAlert) return;
    const t = setTimeout(() => setHandAlert(null), 9000);
    return () => clearTimeout(t);
  }, [handAlert]);

  useEffect(() => {
    R.join();
    return () => { R.leave(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room.id]);

  const mods      = R.participants.filter(p => p.moderator);
  const speakers  = R.participants.filter(p => p.role === "speaker" && !p.moderator);
  const audience  = R.participants.filter(p => p.role !== "speaker");
  const hands     = audience.filter(p => p.hand_raised);

  const onStage = R.role === "speaker";
  const canModerate = R.moderator;

  const leaveAll = async () => { await R.leave(); onLeave(); };

  return createPortal(
    /* Portalled to <body>: rendered inside the frame, the bottom tab bar
       painted over the mic controls — the same trap the composer had. */
    <div style={{ position: "fixed", inset: 0, background: T.ink, zIndex: 990, display: "flex", flexDirection: "column" }}>

      {/* ✋ someone wants to speak — visible to everyone on stage */}
      {handAlert && (
        <div style={{
          position: "absolute", top: 66, left: 14, right: 14, zIndex: 20,
          background: T.ink2, border: `1px solid ${T.gold}66`, borderRadius: 16,
          padding: "12px 14px", display: "flex", alignItems: "center", gap: 11,
          boxShadow: `0 10px 30px #00000035`,
        }}>
          <Hand size={18} color={T.gold} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontFamily: "'Inter',sans-serif", color: T.cream }}>
            <strong>{handAlert.name?.split(" ")[0] || handAlert.id}</strong> wants to speak
          </span>
          {canModerate && (
            <button onClick={() => { R.bringUp(handAlert.id); setHandAlert(null); }} style={{
              border: "none", cursor: "pointer", borderRadius: 999, padding: "8px 14px",
              background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`, color: "#FFF",
              fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5,
            }}>Bring up</button>
          )}
          <X size={16} color={T.dim} style={{ cursor: "pointer" }} onClick={() => setHandAlert(null)} />
        </div>
      )}

      {/* header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px 12px", borderBottom: `1px solid ${T.line}`,
      }}>
        <ChevronDown size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={leaveAll} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>{room.title}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
            <span style={{ width: 6, height: 6, borderRadius: 3, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />
            <span style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              {R.status === "joining"
                ? "Connecting…"
                : R.participants.length === 1 ? "Just you so far"
                : `${R.participants.length} here`}
            </span>
          </div>
        </div>
      </div>

      {/* Browsers block sound until the page has been interacted with. */}
      {R.audioBlocked && (
        <div onClick={R.unblockAudio} style={{
          margin: "10px 16px 0", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
          fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 700,
          background: `${T.gold}18`, border: `1px solid ${T.gold}55`, color: T.gold,
          display: "flex", alignItems: "center", gap: 9,
        }}><Volume2 size={16} />Tap to turn the sound on</div>
      )}

      <div style={{ flex: 1, overflowY: "auto", padding: "22px 18px 8px" }}>

        {mods.length > 0 && (<>
          <Row T={T} label="MODERATORS" count={mods.length} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 30 }}>
            {mods.map(p => (
              <Face key={p.id} T={T} person={p} size={82}
                speaking={R.speaking.includes(p.id)} onClick={() => setTapped(p)} />
            ))}
          </div>
        </>)}

        {speakers.length > 0 && (<>
          <Row T={T} label="SPEAKERS" count={speakers.length} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 30 }}>
            {speakers.map(p => (
              <Face key={p.id} T={T} person={p} size={62}
                speaking={R.speaking.includes(p.id)} onClick={() => setTapped(p)} />
            ))}
          </div>
        </>)}

        {/* The queue sits where a moderator is already looking, rather than
            behind a button they have to remember to press. */}
        {canModerate && hands.length > 0 && (
          <div style={{
            marginBottom: 26, padding: "14px 15px", borderRadius: 16,
            background: `${T.gold}0E`, border: `1px solid ${T.gold}40`,
          }}>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.gold, fontWeight: 700, fontFamily: "'Inter',sans-serif", marginBottom: 12 }}>
              {hands.length === 1 ? "1 PERSON WANTS TO SPEAK" : `${hands.length} PEOPLE WANT TO SPEAK`}
            </div>
            {hands.map(p => (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 9 }}>
                <div style={{ width: 34, height: 34, borderRadius: "50%", overflow: "hidden", background: T.card, flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 12, color: T.cream }}>
                  {p.avatar_url
                    ? <img src={mediaUrl(p.avatar_url)} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : p.id}
                </div>
                <span style={{ flex: 1, fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{p.name}</span>
                <button onClick={() => R.bringUp(p.id)} style={{
                  padding: "8px 15px", borderRadius: 999, border: "none", cursor: "pointer",
                  background: T.gold, color: T.ink,
                  fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5,
                }}>Invite up</button>
              </div>
            ))}
          </div>
        )}

        <Row T={T} label="IN THE AUDIENCE" count={audience.length} />
        {audience.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 15 }}>
            {audience.map(p => (
              <Face key={p.id} T={T} person={p} size={48} onClick={() => setTapped(p)} />
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
            <Users size={14} />Nobody else is listening yet.
          </div>
        )}

        <div style={{ height: 30 }} />
      </div>

      {/* Errors sit directly above the controls, because that is where the
          finger that caused them already is. A message at the top of a
          scrolling room is a message nobody reads. */}
      {R.error && (
        <div onClick={R.clearError} style={{
          margin: "0 18px 10px", padding: "12px 14px", borderRadius: 12, cursor: "pointer",
          fontSize: 12.5, fontFamily: "'Inter',sans-serif", lineHeight: 1.5,
          background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
        }}>{R.error}</div>
      )}

      {/* A listener should never have to wonder how to speak. */}
      {!onStage && R.status === "live" && !R.handRaised && !R.error && (
        <div style={{
          margin: "0 18px 10px", padding: "11px 14px", borderRadius: 12,
          background: T.card, border: `1px solid ${T.line}`,
          fontSize: 12.5, lineHeight: 1.5, color: T.dim, fontFamily: "'Inter',sans-serif",
        }}>
          You are listening. Raise your hand and a moderator can bring you on stage to talk.
        </div>
      )}
      {!onStage && R.handRaised && (
        <div style={{
          margin: "0 18px 10px", padding: "11px 14px", borderRadius: 12,
          background: `${T.gold}12`, border: `1px solid ${T.gold}45`,
          fontSize: 12.5, lineHeight: 1.5, color: T.gold, fontFamily: "'Inter',sans-serif",
        }}>
          Your hand is up. A moderator will bring you in when there is a gap.
        </div>
      )}
      {onStage && (
        <div style={{
          margin: "0 18px 10px", padding: "11px 14px", borderRadius: 12,
          background: R.micOn ? `${T.gold}12` : T.card,
          border: `1px solid ${R.micOn ? `${T.gold}45` : T.line}`,
          fontSize: 12.5, lineHeight: 1.5, fontFamily: "'Inter',sans-serif",
          color: R.micOn ? T.gold : T.dim,
        }}>
          {R.micOn
            ? "Your microphone is on. Everyone in the room can hear you."
            : "You are on stage and muted. Tap the microphone when you want to talk."}
        </div>
      )}

      {/* controls */}
      <div style={{
        display: "flex", gap: 10, padding: "10px 18px calc(16px + env(safe-area-inset-bottom))",
        borderTop: `1px solid ${T.line}`, background: T.ink,
      }}>
        <button onClick={leaveAll} style={{
          padding: "13px 17px", borderRadius: 999, border: `1px solid ${T.line}`, cursor: "pointer",
          background: T.card, color: T.community,
          display: "flex", alignItems: "center", gap: 7,
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13,
        }}><LogOut size={15} />Leave</button>

        {/* 💬 room chat */}
        <button onClick={() => setChatOpen(o => !o)} style={{
          position: "relative",
          padding: "13px 15px", borderRadius: 999, border: `1px solid ${chatOpen ? T.gold : T.line}`,
          cursor: "pointer", background: chatOpen ? `${T.gold}14` : T.card, color: chatOpen ? T.gold : T.cream,
          display: "flex", alignItems: "center",
        }}>
          <MessageCircle size={17} />
          {chatUnread > 0 && !chatOpen && (
            <span style={{
              position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9,
              background: T.gold, color: "#FFF", fontSize: 10, fontWeight: 800, padding: "0 4px",
              display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
            }}>{chatUnread}</span>
          )}
        </button>

        {onStage ? (
          /* The single most important control in the app when you are on
             stage, so it is the loudest thing in the bar: gold when off, so
             it reads as the thing to press, not as a disabled control. */
          <button onClick={R.toggleMic} disabled={R.status !== "live"} style={{
            flex: 1, padding: "15px 0", borderRadius: 999,
            cursor: R.status === "live" ? "pointer" : "default",
            background: R.micOn ? T.card : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
            border: R.micOn ? `1px solid ${T.gold}` : "none",
            color: R.micOn ? T.gold : T.ink,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 9,
          }}>
            {R.micOn ? <Mic size={18} /> : <MicOff size={18} />}
            {R.micOn ? "You are live · tap to mute" : "Tap to unmute and speak"}
          </button>
        ) : (
          <button onClick={() => R.raiseHand(!R.handRaised)} disabled={R.status !== "live"} style={{
            flex: 1, padding: "13px 0", borderRadius: 999,
            cursor: R.status === "live" ? "pointer" : "default",
            background: R.handRaised ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
            border: R.handRaised ? `1px solid ${T.gold}` : "none",
            color: R.handRaised ? T.gold : T.ink,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <Hand size={16} />{R.handRaised ? "Lower my hand" : "Raise hand to speak"}
          </button>
        )}
      </div>

      {tapped && (
        <PersonSheet
          T={T} person={tapped} me={profile?.id} canModerate={canModerate}
          onClose={() => setTapped(null)}
          actions={{ bringUp: R.bringUp, stepDown: R.stepDown, openUser }}
        />
      )}

      {/* room chat panel — ephemeral, room-scoped, gone when the room ends */}
      {chatOpen && (
        <div style={{
          position: "absolute", left: 0, right: 0, bottom: 0, height: "55%", zIndex: 30,
          background: T.ink2, borderTop: `1px solid ${T.line}`, borderRadius: "20px 20px 0 0",
          display: "flex", flexDirection: "column", boxShadow: "0 -10px 34px #00000025",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "13px 16px 9px", flexShrink: 0 }}>
            <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Room chat</span>
            <X size={20} color={T.dim} style={{ cursor: "pointer" }} onClick={() => setChatOpen(false)} />
          </div>
          <div ref={chatScrollRef} style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
            {!R.chat.length && (
              <div style={{ padding: "26px 10px", textAlign: "center", fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                Say something — everyone in the room sees it. Messages vanish when the room ends.
              </div>
            )}
            {R.chat.map(m => (
              <div key={m.id} style={{ padding: "6px 0", display: "flex", gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: m.me ? T.gold : T.cream, fontFamily: "'Inter',sans-serif", flexShrink: 0 }}>
                  {m.me ? "You" : (m.name || m.from).split(" ")[0]}
                </span>
                <span style={{ fontSize: 13, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif", minWidth: 0, overflowWrap: "anywhere" }}>{m.text}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8, padding: "9px 14px calc(12px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, flexShrink: 0 }}>
            <input value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && chatInput.trim()) { R.sendChat(chatInput, profile?.name); setChatInput(""); } }}
              placeholder="Message the room…" style={{
                flex: 1, padding: "11px 14px", borderRadius: 999, outline: "none",
                background: T.card, border: `1px solid ${T.line}`, color: T.cream,
                fontSize: 13.5, fontFamily: "'Inter',sans-serif",
              }} />
            <button onClick={() => { if (chatInput.trim()) { R.sendChat(chatInput, profile?.name); setChatInput(""); } }}
              disabled={!chatInput.trim()} style={{
                width: 42, height: 42, borderRadius: 21, border: "none",
                cursor: chatInput.trim() ? "pointer" : "default",
                background: chatInput.trim() ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><Send size={16} color={chatInput.trim() ? "#FFF" : T.dim} /></button>
          </div>
        </div>
      )}

      <style>{`@keyframes ffgPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    </div>,
    document.body
  );
}
