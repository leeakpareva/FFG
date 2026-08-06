import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Home, Users, Calendar, Banknote, User, Heart, MessageCircle, Share2,
  MapPin, ArrowUpRight, Bell, Search, Bookmark, ChevronRight,
  Zap, TrendingUp, Handshake, Plus, BadgeCheck, ChevronLeft, MoreHorizontal,
  Grid3x3, Award, Mic, Trophy, Briefcase, Quote, Send, X, Bot,
  Radio, Hand, MicOff, LogOut, Clock, CalendarCheck, ArrowRight, Check,
  Linkedin, Instagram, Globe, Twitter, Rocket, ImagePlus, BookOpen, Ticket, QrCode, Trash2,
  Play, Pause, GraduationCap, Camera
} from "lucide-react";
import { useAuth, useClerk } from "@clerk/clerk-react";
import { createApi, validateImage, validateMedia, isVideoFile, isVideoUrl, ACCEPTED_IMAGE_TYPES, ACCEPTED_MEDIA_TYPES, mediaUrl } from "./api.js";
import { useViewport } from "./useViewport.js";
import SignInGate from "./SignInGate.jsx";
import DesktopRail from "./DesktopRail.jsx";
import EditProfileSheet from "./EditProfileSheet.jsx";
import Cover from "./Cover.jsx";
import { readFlag, writeFlag, readJSON, writeJSON } from "./persist.js";

/* Loaded only when someone actually enters a room: RoomStage drags
   livekit-client with it, which is far too heavy to make every member
   download just to read the feed. */
const RoomStage = React.lazy(() => import("./RoomStage.jsx"));

const LOGO_DARK_MARK = "data:image/png;base64,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";

/* ---------- design tokens ---------- */
/**
 * Light is the only theme. The dark palette and its light-on-dark logo were
 * removed at the client's request — see git history if it is ever revived.
 */
/* The public FFG website — where prospective members apply. */
const SITE_URL = "https://forbes-family-group.vercel.app";

const LIGHT = {
  mode: "light",
  ink: "#F7F4EE",
  ink2: "#FFFFFF",
  card: "#FFFFFF",
  line: "#E5E1D6",
  cream: "#17171B",
  dim: "#8A867C",
  gold: "#A8894E",
  goldSoft: "#8A6F3C",
  connect: "#5E7A94",
  community: "#4F7A62",
  logo: LOGO_DARK_MARK,
};

let T = LIGHT;

/* ---------- zodiac particle field ---------- */
const ZodiacField = ({ density = 42, opacity = 1, color = "200, 168, 103" }) => {
  const ref = React.useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0, h = 0, stars = [], raf, running = true;

    const seed = () => {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = Math.max(1, w * dpr); canvas.height = Math.max(1, h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.floor(density * (w * h) / (400 * 800));
      stars = Array.from({ length: Math.max(20, count) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.5 + 0.4,
        vx: (Math.random() - 0.5) * 0.08,
        vy: (Math.random() - 0.5) * 0.08,
        phase: Math.random() * Math.PI * 2,
      }));
    };
    seed();
    const ro = new ResizeObserver(() => seed());
    ro.observe(canvas);

    const tick = () => {
      if (!running) return;
      ctx.clearRect(0, 0, w, h);
      // connection lines (constellation feel)
      ctx.lineWidth = 0.5;
      for (let i = 0; i < stars.length; i++) {
        for (let j = i + 1; j < stars.length; j++) {
          const dx = stars[i].x - stars[j].x, dy = stars[i].y - stars[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 120) {
            const a = (1 - d / 120) * 0.35 * opacity;
            ctx.strokeStyle = `rgba(${color}, ${a})`;
            ctx.beginPath();
            ctx.moveTo(stars[i].x, stars[i].y);
            ctx.lineTo(stars[j].x, stars[j].y);
            ctx.stroke();
          }
        }
      }
      // stars
      stars.forEach(s => {
        s.x += s.vx; s.y += s.vy; s.phase += 0.018;
        if (s.x < -10) s.x = w + 10; if (s.x > w + 10) s.x = -10;
        if (s.y < -10) s.y = h + 10; if (s.y > h + 10) s.y = -10;
        const twinkle = Math.sin(s.phase) * 0.35 + 0.65;
        const a = twinkle * opacity;
        ctx.fillStyle = `rgba(${color}, ${a})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        // faint halo on brighter stars
        if (s.r > 1.2) {
          const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, s.r * 5);
          grad.addColorStop(0, `rgba(${color}, ${a * 0.5})`);
          grad.addColorStop(1, `rgba(${color}, 0)`);
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.r * 5, 0, Math.PI * 2);
          ctx.fill();
        }
      });
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => { running = false; cancelAnimationFrame(raf); ro.disconnect(); };
  }, [density, opacity, color]);
  return <canvas ref={ref} style={{
    position: "absolute", inset: 0, width: "100%", height: "100%",
    pointerEvents: "none", zIndex: 0,
  }} />;
};



const PILLAR = {
  Capital: { k: "gold", icon: Banknote },
  Community: { k: "community", icon: Users },
  Connect: { k: "connect", icon: Handshake },
};

const font = document.createElement("link");
font.rel = "stylesheet";
font.href = "https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,500&display=swap";
document.head.appendChild(font);

/* ---------- members ----------

   The directory used to be a hardcoded cast of sample people. The app is
   live now, so USERS is hydrated from /api/members once a member signs in.
   It stays module-level because every screen reads USERS[id] directly; the
   shell bumps a counter after hydration so everything re-renders with the
   real people in place.

   highlights/tiles are profile decorations members will curate later — an
   empty array is the honest value until they do. */
let USERS = {};
const hydrateUsers = (list) => {
  USERS = Object.fromEntries(list.map((m) => [m.id, {
    ...m,
    posts: m.posts ?? 0,
    followers: m.followers ?? 0,
    following: m.following ?? 0,
    highlights: m.highlights || [],
    tiles: m.tiles || [],
  }]));
};

/* Stock imagery belonged to the sample cast and left with it. These stay as
   empty maps so every lookup falls through to initials / no image. */
const PHOTOS = {};
const EVENT_PICS = {};
const PROFILE_EXTRAS = {};

/* Real content only, now the app is live. Empty until members create it
   (posts) or the FFG team publishes it (events, articles, replays,
   workshops). Live rooms come from the API, not this constant. */
const POSTS = [];
const SUGGESTED = [];
const MATCHES = [];
const EVENTS = [];
const ROOMS = [];
const FOUNDERS = [];
const ARTICLES = [];

/**
 * Fills the content shelves from the API, in the shapes the tabs were
 * originally written against — so the admin panel publishing something is
 * all it takes for it to appear here. Arrays are mutated in place because
 * every screen closes over these exact references.
 */
const hydrateContent = ({ articles, events, replays, workshops }) => {
  ARTICLES.length = 0;
  ARTICLES.push(...(articles || []).map(a => ({
    id: a.id, title: a.title, excerpt: a.excerpt || "", tag: a.tag,
    author: a.author_id, read: a.read_time || "", time: a.published_label || "",
    image: null, image_url: a.image_url, ai: false, body: null,
  })));
  EVENTS.length = 0;
  EVENTS.push(...(events || []).map(e => ({
    id: e.id, name: e.name, where: e.venue, date: e.day, month: e.month,
    time: e.time_label || "", tag: e.tag, spots: e.spots || "Open",
    host: e.host_id, image: null, image_url: e.image_url, about: e.about || "",
    price_pence: e.price_pence || null, starts_at: e.starts_at || null,
    attending: !!e.attending, payment_pending: !!e.payment_pending,
  })));
  REPLAYS.length = 0;
  REPLAYS.push(...(replays || []).map(r => ({
    id: r.id, title: r.title, summary: r.summary || "", tag: r.tag,
    duration: r.duration || "45 min", speakers: r.speakers || [],
    chapters: r.chapters || [], image: null, image_url: r.image_url,
    has_video: r.has_video,
    date: r.created_at ? new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "",
  })));
  WORKSHOPS.length = 0;
  WORKSHOPS.push(...(workshops || []).map(w => ({
    id: w.id, title: w.title, blurb: w.blurb || "", tag: w.tag,
    level: w.level || "Beginner", duration: w.duration || "90 min",
    sessions: w.sessions || 1,
    seats: { taken: w.seats_taken || 0, total: w.seats_total || 20 },
    host: w.host_id, live: w.is_live, when: w.when_label || "",
    outcomes: w.outcomes || [], image: null, image_url: w.image_url,
  })));
};

/* Watch — recordings of events that have already happened. Separate from
   EVENTS on purpose: an event is a thing you attend, a replay is a thing
   you watch afterwards. */
const REPLAYS = [];

/* Learn — live workshops. They run at a fixed time with a cohort: seats are
   finite and the value is being in the room while it happens. */
const WORKSHOPS = [];

const calcMatch = (user, member) => {
  const ex = PROFILE_EXTRAS[user.id] || {};
  let score = ex.baseMatch || 80;
  let shared = [];
  if (member?.interests?.length && ex.interests?.length) {
    shared = ex.interests.filter(i => member.interests.includes(i));
    score = Math.min(98, Math.max(score - 8, 72) + shared.length * 5);
  }
  return { score, shared };
};

/* ---------- tiny UI atoms ---------- */
/**
 * The Connect Concierge mark: two interlocking circles.
 *
 * Deliberately not a sparkle/star — every AI product uses one. Two rings
 * meeting reads as connection, which is the point of the product, and it
 * stays legible down to 13px where a star turns to mush.
 */
const AgentMark = ({ size = 16, color, strokeWidth = 1.9, style }) => (
  <svg
    width={size} height={size} viewBox="0 0 24 24" fill="none"
    style={{ flexShrink: 0, ...style }} aria-hidden="true"
  >
    <circle cx="9.1" cy="12" r="5.9" stroke={color || T.gold} strokeWidth={strokeWidth} />
    <circle cx="14.9" cy="12" r="5.9" stroke={color || T.gold} strokeWidth={strokeWidth} />
  </svg>
);

/**
 * `src` is an uploaded photo and wins over everything: it is the member's own
 * choice. PHOTOS is the stock portrait for the demo users, and the initials
 * are the last resort.
 */
const Avatar = ({ initials, ring, size = 44, onClick, src }) => {
  const photo = src || PHOTOS[initials];
  return (
    <div onClick={onClick} style={{
      width: size, height: size, borderRadius: "50%", flexShrink: 0, overflow: "hidden",
      background: `linear-gradient(135deg, ${T.card}, ${T.ink2})`,
      border: `2px solid ${ring || T.line}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: size * 0.34,
      color: T.cream, letterSpacing: "0.02em", cursor: onClick ? "pointer" : "default",
    }}>
      {photo
        ? <img src={photo} alt={initials} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        : initials}
    </div>
  );
};

const PillarTag = ({ name }) => {
  const p = PILLAR[name]; const Ico = p.icon; const c = T[p.k];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: 11, fontWeight: 600, color: c,
      background: `${c}1A`, border: `1px solid ${c}40`,
      padding: "3px 9px", borderRadius: 999, letterSpacing: "0.04em",
    }}><Ico size={11} strokeWidth={2.5} />{name.toUpperCase()}</span>
  );
};


/* ---------- onboarding ---------- */
const ROLES = ["Founder", "Investor", "Mentor", "Creative", "Operator", "Student", "Career professional", "Community builder"];
const REASONS = ["Raise funding", "Find a mentor", "Grow my network", "Attend events", "Learn AI & digital", "Find collaborators", "Back founders", "Give back"];
const INTERESTS = ["Startups", "Tech & AI", "Music & culture", "Finance", "Property", "Wellness", "Fashion", "Media", "Sport", "Food", "Community work", "Education"];

const obField = () => ({
  width: "100%", padding: "15px 16px", borderRadius: 14, outline: "none",
  background: T.card, border: `1px solid ${T.line}`, color: T.cream,
  fontSize: 15, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
});

const Chip = ({ label, on, onClick }) => (
  <button onClick={onClick} style={{
    padding: "10px 16px", borderRadius: 999, cursor: "pointer",
    background: on ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
    border: on ? "none" : `1px solid ${T.line}`,
    color: on ? T.ink : T.cream, fontSize: 13.5, fontFamily: "'Inter',sans-serif",
    fontWeight: on ? 700 : 500, transition: "all 0.15s",
    display: "inline-flex", alignItems: "center", gap: 6,
  }}>{on && <Check size={13} strokeWidth={3} />}{label}</button>
);

const Onboarding = ({ onComplete }) => {
  const [step, setStep] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const [p, setP] = useState({
    name: "", role: null, reasons: [], interests: [], project: "",
    linkedin: "", instagram: "", x: "", website: "",
  });
  const set = (k, v) => setP(prev => ({ ...prev, [k]: v }));
  const toggle = (k, v) => setP(prev => ({
    ...prev, [k]: prev[k].includes(v) ? prev[k].filter(x => x !== v) : [...prev[k], v],
  }));

  const STEPS = [
    {
      eyebrow: "FIRST THINGS FIRST", title: "What should we call you?",
      valid: () => p.name.trim().length > 1,
      body: (
        <input value={p.name} onChange={e => set("name", e.target.value)} placeholder="Your name" autoFocus style={obField()} />
      ),
    },
    {
      eyebrow: "YOUR SEAT AT THE TABLE", title: "Which best describes you?",
      valid: () => !!p.role,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {ROLES.map(r => <Chip key={r} label={r} on={p.role === r} onClick={() => set("role", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "YOUR AMBITION", title: "What brings you to FFG?",
      hint: "Choose as many as apply — this shapes your matches, rooms and events.",
      valid: () => p.reasons.length > 0,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {REASONS.map(r => <Chip key={r} label={r} on={p.reasons.includes(r)} onClick={() => toggle("reasons", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "YOUR WORLD", title: "Pick your interests",
      hint: "We'll use these to suggest rooms and people worth your time.",
      valid: () => p.interests.length >= 3,
      body: (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 9 }}>
          {INTERESTS.map(r => <Chip key={r} label={r} on={p.interests.includes(r)} onClick={() => toggle("interests", r)} />)}
        </div>
      ),
    },
    {
      eyebrow: "WHAT YOU'RE BUILDING", title: "Tell us about your current project",
      hint: "A sentence or two is perfect. You can refine this later.",
      valid: () => true,
      body: (
        <textarea value={p.project} onChange={e => set("project", e.target.value)} rows={4}
          placeholder="e.g. A payments platform for diaspora businesses, currently raising pre-seed…"
          style={{ ...obField(), resize: "none", lineHeight: 1.5 }} />
      ),
    },
    {
      eyebrow: "BRING YOUR WORLD WITH YOU", title: "Connect your links",
      hint: "Optional — but members with links get 3× more connection requests.",
      valid: () => true,
      body: (
        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          {[
            ["linkedin", Linkedin, "LinkedIn profile URL"],
            ["instagram", Instagram, "Instagram handle"],
            ["x", Twitter, "X handle"],
            ["website", Globe, "Your website"],
          ].map(([k, Ico, ph]) => (
            <div key={k} style={{ position: "relative" }}>
              <Ico size={17} color={p[k] ? T.gold : T.dim} style={{ position: "absolute", left: 15, top: "50%", transform: "translateY(-50%)" }} />
              <input value={p[k]} onChange={e => set(k, e.target.value)} placeholder={ph}
                style={{ ...obField(), paddingLeft: 44 }} />
            </div>
          ))}
        </div>
      ),
    },
  ];

  const s = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = () => {
    setFinishing(true);
    setTimeout(() => onComplete(p), 2200);
  };

  if (finishing) {
    return (
      <div style={{
        position: "absolute", inset: 0, background: T.ink, zIndex: 49,
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 26, padding: 40,
      }}>
        <div style={{ position: "relative", width: 92, height: 92, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${T.line}`, borderTopColor: T.gold,
            animation: "ffgSpin 1s linear infinite",
          }} />
          <img src={T.logo} alt="" style={{ width: 44, height: 44 }} />
        </div>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 20, color: T.cream, marginBottom: 8 }}>
            Welcome, {p.name.split(" ")[0]}.
          </div>
          <div style={{ fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.6 }}>
            Curating your rooms, matches and events<br />around {p.interests.slice(0, 2).join(" and ").toLowerCase()}…
          </div>
        </div>
        <style>{`@keyframes ffgSpin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 49, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <ZodiacField density={38} opacity={0.35} />
      {/* progress */}
      <div style={{ position: "relative", zIndex: 2, display: "flex", alignItems: "center", gap: 14, padding: "18px 18px 6px" }}>
        {step > 0
          ? <ChevronLeft size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={() => setStep(x => x - 1)} />
          : <img src={T.logo} alt="" style={{ width: 22, height: 22 }} />}
        <div style={{ flex: 1, height: 3, borderRadius: 2, background: T.line, overflow: "hidden" }}>
          <div style={{
            height: "100%", width: `${((step + 1) / STEPS.length) * 100}%`,
            background: `linear-gradient(90deg, ${T.gold}, ${T.goldSoft})`,
            transition: "width 0.4s cubic-bezier(.2,.8,.2,1)",
          }} />
        </div>
        <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif", fontVariantNumeric: "tabular-nums" }}>{step + 1}/{STEPS.length}</span>
      </div>

      {/* step content — vertically centred */}
      <div key={step} style={{
        position: "relative", zIndex: 2, flex: 1, overflowY: "auto", padding: "26px 22px",
        display: "flex", flexDirection: "column", justifyContent: "center",
        animation: "ffgStepIn 0.5s cubic-bezier(.2,.8,.2,1)",
      }}>
        <div style={{ fontSize: 11, letterSpacing: "0.18em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>{s.eyebrow}</div>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 28, color: T.cream, lineHeight: 1.2, marginBottom: s.hint ? 10 : 26 }}>{s.title}</div>
        {s.hint && <div style={{ fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.55, marginBottom: 26 }}>{s.hint}</div>}
        {s.body}
      </div>
      <style>{`@keyframes ffgStepIn { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }`}</style>

      {/* actions */}
      <div style={{ position: "relative", zIndex: 2, padding: "12px 22px calc(18px + env(safe-area-inset-bottom))" }}>
        <button
          onClick={() => last ? finish() : setStep(x => x + 1)}
          disabled={!s.valid()}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 999, border: "none",
            cursor: s.valid() ? "pointer" : "default",
            background: s.valid() ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            color: s.valid() ? T.ink : T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15,
            animation: s.valid() ? "ffgCtaGlow 2.4s ease-in-out infinite" : "none",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            transition: "all 0.25s",
          }}>
          {last ? (<><Rocket size={16} />Enter FFG</>) : (<>Continue<ArrowRight size={16} /></>)}
        </button>
        {last && (
          <button onClick={finish} style={{
            width: "100%", marginTop: 10, padding: "8px 0", background: "none", border: "none",
            color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif", cursor: "pointer",
          }}>Skip for now</button>
        )}
      </div>
    </div>
  );
};

/* ---------- instagram-style profile ---------- */
const ProfileTile = ({ tile }) => {
  const col = T[tile.c] || tile.c;
  return (
  <div style={{
    aspectRatio: "1", borderRadius: 4, overflow: "hidden", position: "relative",
    background: `linear-gradient(150deg, ${col}22, ${T.ink2} 70%)`,
    border: `1px solid ${T.line}`, display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center", padding: 10, textAlign: "center", gap: 6,
  }}>
    {tile.k === "stat" && (<>
      <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 24, color: col }}>{tile.v}</span>
      <span style={{ fontSize: 9.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em", lineHeight: 1.3 }}>{tile.l.toUpperCase()}</span>
    </>)}
    {tile.k === "quote" && (<>
      <Quote size={13} color={col} style={{ opacity: 0.7 }} />
      <span style={{ fontSize: 11, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: 500, lineHeight: 1.4 }}>{tile.v}</span>
    </>)}
    {tile.k === "icon" && (() => { const Ico = tile.icon; return (<>
      <Ico size={22} color={col} strokeWidth={1.8} />
      <span style={{ fontSize: 9.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.04em", lineHeight: 1.3 }}>{tile.l.toUpperCase()}</span>
    </>); })()}
  </div>
  );
};

/**
 * The 3-column media grid — the Instagram read of a member's posts.
 * Media posts show their picture (video gets a play badge); text posts
 * become quiet text tiles, so nothing a member shares disappears.
 */
const PostGrid = ({ posts, emptyTitle, emptyHint, onOpen }) => {
  if (!posts) return <div style={{ padding: "34px 18px", textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Loading…</div>;
  if (!posts.length) {
    return (
      <div style={{ padding: "44px 18px", textAlign: "center" }}>
        <Users size={30} color={T.dim} style={{ marginBottom: 10 }} />
        <div style={{ fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{emptyTitle}</div>
        {emptyHint && <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 6 }}>{emptyHint}</div>}
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 2, padding: 2 }}>
      {posts.map(p => (
        <div key={p.id} onClick={() => onOpen(p)} style={{
          position: "relative", aspectRatio: "1", cursor: "pointer", overflow: "hidden",
          background: T.card, border: `1px solid ${T.line}`,
        }}>
          {p.image_url ? (
            isVideoUrl(p.image_url) ? (
              <>
                <video src={mediaUrl(p.image_url)} muted playsInline preload="metadata"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div style={{
                  position: "absolute", top: 6, right: 6, width: 22, height: 22, borderRadius: 11,
                  background: "#000000AA", display: "flex", alignItems: "center", justifyContent: "center",
                }}><Play size={11} color="#FFF" fill="#FFF" /></div>
              </>
            ) : (
              <img src={mediaUrl(p.image_url)} alt="" loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            )
          ) : (
            <div style={{
              width: "100%", height: "100%", padding: 8, boxSizing: "border-box",
              fontSize: 10.5, lineHeight: 1.45, color: T.dim, fontFamily: "'Inter',sans-serif",
              overflow: "hidden",
            }}>{p.text}</div>
          )}
        </div>
      ))}
    </div>
  );
};

/** One post, full-screen — tapped open from a profile grid. Portalled to
    <body> so the tab bar can never paint over it. Your own posts can be
    deleted right here — the grid is where members manage their photos. */
const PostViewer = ({ post, member, openUser, onClose, canDelete, onDeleted }) => {
  const { getToken } = useAuth();
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comments || 0);
  const destroy = async () => {
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await createApi(getToken).deletePost(post.id);
      onDeleted && onDeleted();
      onClose();
    } catch { /* the server said no; the post stays */ }
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", background: T.ink }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Post</span>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {canDelete && (
            <Trash2 size={19} color="#B3261E" style={{ cursor: "pointer" }} onClick={destroy} />
          )}
          <X size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {post.image_url && (
          isVideoUrl(post.image_url)
            ? <video src={mediaUrl(post.image_url)} controls playsInline autoPlay muted
                style={{ width: "100%", maxHeight: "60vh", background: "#000", display: "block" }} />
            : <img src={mediaUrl(post.image_url)} alt="" style={{ width: "100%", display: "block" }} />
        )}
        <div style={{ padding: "16px 18px" }}>
          <p style={{ margin: "0 0 10px", fontSize: 14.5, lineHeight: 1.55, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{post.text}</p>
          {post.tags?.length > 0 && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {post.tags.map(t => (
                <span key={t.id} onClick={() => { onClose(); openUser(t.id); }} style={{
                  fontSize: 12, fontWeight: 600, color: T.connect, cursor: "pointer",
                  background: `${T.connect}12`, borderRadius: 999, padding: "4px 10px",
                  fontFamily: "'Inter',sans-serif",
                }}>with {t.name}</span>
              ))}
            </div>
          )}
          <LikeRow likes={post.likes} comments={commentCount} liked={post.liked}
            onToggle={() => createApi(getToken).likePost(post.id)}
            saved={post.saved} onSave={() => createApi(getToken).savePost(post.id)}
            onComments={() => setCommentsOpen(true)} />
          {commentsOpen && (
            <CommentsSheet postId={post.id} onClose={() => setCommentsOpen(false)} onCount={setCommentCount} />
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

const UserProfile = ({ user, onBack, member, openMessages, openNotifs, openChat, profile, onProfileSaved, openUser, composeSignal, openConcierge, unreadDMs = 0 }) => {
  const [following, setFollowing] = useState(!!user.followed_by_me);
  const [gridTab, setGridTab] = useState("grid");
  const [showMenu, setShowMenu] = useState(false);
  const [toast, setToast] = useState(null);
  const [muted, setMuted] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [editing, setEditing] = useState(false);
  const [composing, setComposing] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoErr, setPhotoErr] = useState(null);
  const avatarFileRef = React.useRef(null);
  const { getToken } = useAuth();
  const { signOut } = useClerk();

  /* The shell's floating button on this tab means "new post" — it bumps
     composeSignal and the composer opens here. */
  const composeSeen = React.useRef(composeSignal);
  useEffect(() => {
    if (composeSignal !== composeSeen.current) {
      composeSeen.current = composeSignal;
      if (user.me) setComposing(true);
    }
  }, [composeSignal, user.me]);

  /* The Instagram part: the grid is this member's real posts, the second
     tab is posts they're tagged in. gridVersion bumps after posting from
     this page so the new post appears without leaving it. */
  const [gridPosts, setGridPosts] = useState(null);
  const [taggedPosts, setTaggedPosts] = useState(null);
  const [gridVersion, setGridVersion] = useState(0);
  const [viewingPost, setViewingPost] = useState(null);
  useEffect(() => {
    let live = true;
    const api = createApi(getToken);
    api.memberPosts(user.id)
      .then(({ posts }) => { if (live) setGridPosts(posts); })
      .catch(() => { if (live) setGridPosts([]); });
    api.memberTagged(user.id)
      .then(({ posts }) => { if (live) setTaggedPosts(posts); })
      .catch(() => { if (live) setTaggedPosts([]); });
    return () => { live = false; };
  }, [user.id, gridVersion, getToken]);

  /** Publish from your own page — same pipeline as the feed composer. */
  const publishFromProfile = async ({ text, imageKey, tags }) => {
    await createApi(getToken).createPost({
      body: text, pillar: 'Community', image_key: imageKey || undefined, tags,
    });
    setToast("Posted to the feed");
    setGridVersion(v => v + 1); // the grid below should show it immediately
    setTimeout(() => setToast(null), 2600);
  };
  const ex = PROFILE_EXTRAS[user.id] || {};

  // On your own profile the server row is the truth; the demo constants only
  // supply the decorative extras (tiles, highlights) that have no table yet.
  const own = !!user.me && !!profile;
  if (own) {
    user = {
      ...user,
      name: profile.name, handle: profile.handle, role: profile.role,
      pillar: profile.pillar, bio: profile.bio || "", verified: profile.verified,
      posts: profile.posts, followers: profile.followers, following: profile.following,
    };
  }
  const avatarSrc = own && profile.avatar_url ? mediaUrl(profile.avatar_url) : null;

  /** Upload straight from the profile page — no need to open the editor. */
  const pickAvatar = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const problem = validateImage(file);
    if (problem) { setPhotoErr(problem); return; }

    setPhotoErr(null);
    setPhotoBusy(true);
    try {
      const api = createApi(getToken);
      const saved = await api.uploadImage(file, { kind: "avatar", alt: `${user.name} profile photo` });
      onProfileSaved(await api.updateProfile({ avatar_media_id: saved.id }));
      setToast("Photo updated");
      setTimeout(() => setToast(null), 1800);
    } catch (e2) {
      setPhotoErr(e2.message || "Could not upload that photo.");
    } finally {
      setPhotoBusy(false);
    }
  };
  const { score, shared } = calcMatch(user, member);
  const LINK_ICONS = { linkedin: Linkedin, instagram: Instagram, x: Twitter, website: Globe };

  const act = (label, fn) => { fn && fn(); setShowMenu(false); setToast(label); setTimeout(() => setToast(null), 1800); };

  /* The profile link is a real deep link: the shell reads ?u= on load and
     opens that member once the directory arrives. */
  const profileLink = `${window.location.origin}/?u=${encodeURIComponent(user.handle || user.id)}`;
  const copyLink = () => navigator.clipboard?.writeText(profileLink);
  const shareLink = () => {
    if (navigator.share) {
      navigator.share({ title: `${user.name} on Connect`, url: profileLink }).catch(() => {});
    } else {
      copyLink();
    }
  };

  const [showSaved, setShowSaved] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [followList, setFollowList] = useState(null); // "Followers" | "Following"

  const menuItems = user.me
    ? [
        { icon: AgentMark, label: "Ask the Concierge", fn: () => openConcierge && openConcierge() },
        { icon: AgentMark, label: "Refresh AI briefing", done: "Briefing is back on your Home tab",
          fn: () => writeFlag("ffg.briefing.dismissed", "") },
        { icon: Bookmark, label: "Saved posts", fn: () => setShowSaved(true) },
        { icon: QrCode, label: "My QR code", fn: () => setShowQr(true) },
        /* Referral: applications from this link arrive in the admin queue
           tagged with this member's name. */
        { icon: Share2, label: "Invite someone to FFG", done: "Your invite link is copied — share it anywhere",
          fn: () => navigator.clipboard?.writeText(`${SITE_URL}/?ref=${user.id}`) },
        { icon: Globe, label: "Copy profile link", fn: copyLink, done: "Link copied" },
        { icon: LogOut, label: "Log out", danger: true,
          fn: () => { writeFlag("ffg.entered", ""); signOut(); } },
      ]
    : [
        { icon: Share2, label: "Share profile", fn: shareLink, done: navigator.share ? null : "Link copied" },
        { icon: Globe, label: "Copy profile link", fn: copyLink, done: "Link copied" },
        { icon: Bookmark, label: "Save to my list", fn: () => createApi(getToken).followMember(user.id).catch(() => {}), done: "Saved — you now follow them" },
        { icon: muted ? Bell : MicOff, label: muted ? "Unmute" : "Mute posts", fn: () => setMuted(m => !m), done: muted ? "Unmuted" : "Muted" },
        { icon: blocked ? Check : X, label: blocked ? "Unblock" : "Block", fn: () => setBlocked(b => !b), done: blocked ? "Unblocked" : "Blocked", danger: !blocked },
        { icon: Hand, label: "Report", danger: true, done: "Reported to the FFG team",
          fn: () => createApi(getToken).reportMember(user.id, "reported from profile").catch(() => {}) },
      ];
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      {/* top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        {onBack
          ? <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
          : <span style={{ width: 24 }} />}
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{user.handle}</span>
          {user.verified && <BadgeCheck size={15} color={T.gold} />}
        </div>
        <MoreHorizontal size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={() => setShowMenu(true)} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* header */}
        <div style={{ display: "flex", alignItems: "center", gap: 22, padding: "20px 18px 14px" }}>
          <div style={{ position: "relative" }}>
            <div style={{
              padding: 3, borderRadius: "50%",
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldSoft}, ${T[PILLAR[user.pillar].k]})`,
              opacity: photoBusy ? 0.5 : 1, transition: "opacity 0.2s",
            }}>
              <div style={{ padding: 3, borderRadius: "50%", background: T.ink }}>
                <Avatar initials={user.id} size={78} ring="transparent" src={avatarSrc}
                  onClick={own && !photoBusy ? () => avatarFileRef.current?.click() : undefined} />
              </div>
            </div>
            {own && (<>
              <input ref={avatarFileRef} type="file" accept={ACCEPTED_IMAGE_TYPES}
                onChange={pickAvatar} style={{ display: "none" }} />
              <button onClick={() => !photoBusy && avatarFileRef.current?.click()}
                aria-label="Change profile photo" style={{
                  position: "absolute", bottom: 2, right: 2, width: 28, height: 28, borderRadius: 14,
                  background: T.gold, border: `2px solid ${T.ink}`, cursor: photoBusy ? "default" : "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                }}><Camera size={13} color={T.ink} /></button>
            </>)}
          </div>
          <div style={{ flex: 1, display: "flex", justifyContent: "space-around" }}>
            {[[user.posts, "Posts"], [user.followers, "Followers"], [user.following, "Following"]].map(([v, l]) => (
              <div key={l}
                onClick={() => (l === "Followers" || l === "Following") && setFollowList(l)}
                style={{ textAlign: "center", cursor: l === "Posts" ? "default" : "pointer" }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 18, color: T.cream }}>{v}</div>
                <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* bio */}
        <div style={{ padding: "0 18px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{user.name}</span>
            <PillarTag name={user.pillar} />
          </div>
          <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", margin: "4px 0 2px" }}>{user.role}</div>
          {ex.lastPost && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif", margin: "3px 0 8px" }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: T.community }} />Last posted {ex.lastPost}
            </div>
          )}
          <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{user.bio}</p>

          {/* links */}
          {ex.links && (
            <div style={{ display: "flex", gap: 9, marginTop: 11 }}>
              {Object.keys(ex.links).map(k => {
                const Ico = LINK_ICONS[k];
                return (
                  <div key={k} style={{
                    width: 34, height: 34, borderRadius: 10, cursor: "pointer",
                    background: T.card, border: `1px solid ${T.gold}45`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Ico size={15} color={T.gold} /></div>
                );
              })}
            </div>
          )}
        </div>

        {/* actions */}
        <div style={{ display: "flex", gap: 8, padding: "0 18px 14px" }}>
          {user.me ? (
            /* One posting CTA on this page — the dashed bar below. */
            <button style={btnGhost()} disabled={!own}
              onClick={() => setEditing(true)}>Edit profile</button>
          ) : (<>
            <button onClick={async () => {
              setFollowing(f => !f); // optimistic; the server corrects us
              try {
                const { following: real } = await createApi(getToken).followMember(user.id);
                setFollowing(real);
              } catch { setFollowing(f => !f); }
            }} style={{
              ...btnGhost(),
              background: following ? "transparent" : T.gold,
              border: following ? `1px solid ${T.line}` : "none",
              color: following ? T.cream : T.ink, fontWeight: 700,
            }}>{following ? "Following" : "Follow"}</button>
            <button style={btnGhost()} onClick={() => openChat && openChat(user.id)}>Message</button>
          </>)}
        </div>

        {/* the unmissable one: share straight from your page */}
        {user.me && (
          <div style={{ padding: "0 18px 14px" }}>
            <button onClick={() => own && setComposing(true)} disabled={!own} style={{
              width: "100%", padding: "13px 0", borderRadius: 14, cursor: own ? "pointer" : "default",
              border: `1px dashed ${T.gold}80`, background: `${T.gold}0E`,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              color: T.gold, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
            }}>
              <ImagePlus size={17} />Share a photo or video
            </button>
          </div>
        )}

        {/* inbox + notifications (own profile) */}
        {user.me && openMessages && (
          <div style={{ display: "flex", gap: 10, padding: "0 18px 18px" }}>
            <div onClick={openMessages} style={{
              flex: 1, borderRadius: 16, padding: "14px 15px", cursor: "pointer",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", alignItems: "center", gap: 11,
            }}>
              <div style={{ position: "relative" }}>
                <MessageCircle size={21} color={T.gold} />
                {unreadDMs > 0 && (
                <span style={{
                  position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
                  background: T.gold, color: T.ink, fontSize: 10, fontWeight: 800, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{unreadDMs}</span>
                )}
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>Messages</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                  {unreadDMs > 0 ? `${unreadDMs} unread` : "All read"}
                </div>
              </div>
            </div>
            <div onClick={openNotifs} style={{
              flex: 1, borderRadius: 16, padding: "14px 15px", cursor: "pointer",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", alignItems: "center", gap: 11,
            }}>
              <div style={{ position: "relative" }}>
                <Bell size={21} color={T.gold} />
                <span style={{
                  position: "absolute", top: -5, right: -7, minWidth: 16, height: 16, borderRadius: 8,
                  background: T.gold, color: T.ink, fontSize: 10, fontWeight: 800, padding: "0 4px",
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{NOTIFS.filter(n => n.unread).length}</span>
              </div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>Notifications</div>
                <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{NOTIFS.filter(n => n.unread).length} new</div>
              </div>
            </div>
          </div>
        )}

        {/* match card */}
        {!user.me && (
          <div style={{
            margin: "0 18px 18px", borderRadius: 18, padding: "16px 17px",
            background: `linear-gradient(130deg, ${T.gold}20, ${T.ink2} 70%)`,
            border: `1px solid ${T.gold}45`,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 34, color: T.gold, lineHeight: 1 }}>{score}<span style={{ fontSize: 17 }}>%</span></div>
                <div style={{ fontSize: 9, letterSpacing: "0.14em", color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 3 }}>MATCH</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                  <AgentMark size={13} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: T.goldSoft, fontFamily: "'Inter',sans-serif" }}>Why you two should connect</span>
                </div>
                <div style={{ fontSize: 12.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
                  {shared.length > 0
                    ? <>You share {shared.length} interest{shared.length > 1 ? "s" : ""} — {shared.slice(0, 3).join(", ").toLowerCase()} — and {user.name.split(" ")[0]} is active in your pillar.</>
                    : <>{user.name.split(" ")[0]}'s focus complements your goals — strong overlap in ambition and stage.</>}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* working on */}
        {ex.workingOn && (
          <div style={{ padding: "0 18px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 7 }}>CURRENTLY WORKING ON</div>
            <div style={{
              fontSize: 13.5, lineHeight: 1.55, color: T.cream, fontFamily: "'Inter',sans-serif",
              background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "13px 15px",
              display: "flex", gap: 10,
            }}>
              <Zap size={15} color={T.gold} style={{ flexShrink: 0, marginTop: 2 }} />
              {ex.workingOn}
            </div>
          </div>
        )}

        {/* interests */}
        {ex.interests && (
          <div style={{ padding: "0 18px 16px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>INTERESTS</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ex.interests.map(i => {
                const isShared = shared.includes(i);
                return (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 600, fontFamily: "'Inter',sans-serif",
                    padding: "6px 13px", borderRadius: 999,
                    background: isShared ? `${T.gold}22` : T.card,
                    border: `1px solid ${isShared ? T.gold : T.line}`,
                    color: isShared ? T.goldSoft : T.cream,
                    display: "inline-flex", alignItems: "center", gap: 5,
                  }}>{isShared && <Check size={11} strokeWidth={3} />}{i}</span>
                );
              })}
            </div>
            {shared.length > 0 && (
              <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 7 }}>Gold = interests you share</div>
            )}
          </div>
        )}

        {/* posts about */}
        {ex.contentTypes && (
          <div style={{ padding: "0 18px 18px" }}>
            <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>POSTS ABOUT</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {ex.contentTypes.map(c => (
                <span key={c} style={{
                  fontSize: 12, fontFamily: "'Inter',sans-serif", fontWeight: 500,
                  padding: "6px 13px", borderRadius: 8,
                  background: `${T.connect}14`, border: `1px solid ${T.connect}35`, color: T.connect,
                }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* highlights */}
        <div style={{ display: "flex", gap: 18, padding: "0 18px 18px", overflowX: "auto" }}>
          {user.highlights.map(h => {
            const Ico = h.icon;
            return (
              <div key={h.label} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, flexShrink: 0 }}>
                <div style={{
                  width: 58, height: 58, borderRadius: "50%", background: T.card,
                  border: `1.5px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center",
                }}><Ico size={21} color={T.goldSoft} strokeWidth={1.8} /></div>
                <span style={{ fontSize: 11, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{h.label}</span>
              </div>
            );
          })}
        </div>

        {/* grid tabs */}
        <div style={{ display: "flex", borderTop: `1px solid ${T.line}` }}>
          {[["grid", Grid3x3], ["tagged", Users]].map(([id, Ico]) => (
            <div key={id} onClick={() => setGridTab(id)} style={{
              flex: 1, display: "flex", justifyContent: "center", padding: "12px 0", cursor: "pointer",
              borderBottom: gridTab === id ? `2px solid ${T.gold}` : "2px solid transparent",
            }}><Ico size={20} color={gridTab === id ? T.gold : T.dim} /></div>
          ))}
        </div>

        {/* grid */}
        <PostGrid
          posts={gridTab === "grid" ? gridPosts : taggedPosts}
          emptyTitle={gridTab === "grid"
            ? (user.me ? "Nothing here yet" : `${user.name.split(" ")[0]} hasn't posted yet`)
            : `Posts featuring ${user.name.split(" ")[0]} appear here`}
          emptyHint={gridTab === "grid" && user.me ? "Tap New post to share your first photo or video." : null}
          onOpen={setViewingPost}
        />
        {viewingPost && (
          <PostViewer post={viewingPost} member={member} openUser={openUser ?? (() => {})}
            canDelete={viewingPost.uid === profile?.id}
            onDeleted={() => setGridVersion(v => v + 1)}
            onClose={() => setViewingPost(null)} />
        )}
        <div style={{ height: 90 }} />
      </div>

      {/* action menu */}
      {showMenu && (
        <div style={{ position: "absolute", inset: 0, zIndex: 60, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setShowMenu(false)} style={{ position: "absolute", inset: 0, background: "#00000080", backdropFilter: "blur(3px)" }} />
          <div style={{
            position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
            border: `1px solid ${T.line}`, borderBottom: "none",
            padding: "8px 0 calc(12px + env(safe-area-inset-bottom))",
          }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: T.line, margin: "8px auto 12px" }} />
            <div style={{ padding: "0 16px 8px", fontFamily: "'Inter',sans-serif", fontSize: 13, color: T.dim, textAlign: "center" }}>
              {user.me ? <>Account · <span style={{ opacity: 0.7 }}>build {typeof __BUILD_STAMP__ !== "undefined" ? __BUILD_STAMP__ : "dev"}</span></> : `@${user.handle}`}
            </div>
            {menuItems.map(item => {
              const Ico = item.icon;
              return (
                <div key={item.label} onClick={() => act(item.done || item.label, item.fn)} style={{
                  display: "flex", alignItems: "center", gap: 14,
                  padding: "14px 22px", cursor: "pointer",
                  borderTop: `1px solid ${T.line}`,
                }}>
                  <Ico size={18} color={item.danger ? T.community : T.cream} />
                  <span style={{
                    fontSize: 14.5, fontFamily: "'Inter',sans-serif", fontWeight: 500,
                    color: item.danger ? T.community : T.cream,
                  }}>{item.label}</span>
                </div>
              );
            })}
            <div onClick={() => setShowMenu(false)} style={{
              margin: "12px 16px 0", padding: "13px 0", borderRadius: 999,
              background: T.card, border: `1px solid ${T.line}`, textAlign: "center", cursor: "pointer",
              fontSize: 14, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: T.cream,
            }}>Cancel</div>
          </div>
        </div>
      )}

      {/* toast */}
      {toast && (
        <div style={{
          position: "absolute", bottom: 40, left: "50%", transform: "translateX(-50%)",
          background: T.card, border: `1px solid ${T.gold}45`,
          padding: "11px 18px", borderRadius: 999, zIndex: 70,
          fontSize: 13, fontFamily: "'Inter',sans-serif", fontWeight: 600, color: T.cream,
          display: "flex", alignItems: "center", gap: 7,
          animation: "ffgStepIn 0.3s cubic-bezier(.2,.8,.2,1)",
          boxShadow: "0 6px 24px #00000060",
        }}>
          <Check size={14} color={T.gold} />{toast}
        </div>
      )}

      {/* photo upload failure — the editor shows its own, this is for the
          camera button on the header avatar */}
      {photoErr && (
        <div onClick={() => setPhotoErr(null)} style={{
          position: "absolute", bottom: 40, left: 18, right: 18, zIndex: 70, cursor: "pointer",
          padding: "11px 14px", borderRadius: 12, fontSize: 12.5, lineHeight: 1.45,
          fontFamily: "'Inter',sans-serif",
          background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
        }}>{photoErr}</div>
      )}

      {editing && own && (
        <EditProfileSheet
          T={T}
          profile={profile}
          onSaved={onProfileSaved}
          onClose={() => setEditing(false)}
        />
      )}

      {composing && own && (
        <Composer member={{ name: profile.name }} onClose={() => setComposing(false)}
          onPost={publishFromProfile} />
      )}

      {/* Saved posts — the bookmark list, straight from the server. */}
      {showSaved && (
        <SavedSheet onClose={() => setShowSaved(false)} onOpen={p => { setShowSaved(false); setViewingPost(p); }} />
      )}

      {/* My QR code — the deep link, scannable. */}
      {showQr && <QrSheet name={user.name} link={profileLink} onClose={() => setShowQr(false)} />}

      {/* Followers / Following — the IG tap-through */}
      {followList && (
        <FollowListSheet userId={user.id} kind={followList}
          onClose={() => setFollowList(null)}
          onOpen={(id) => { setFollowList(null); openUser && openUser(id); }} />
      )}
    </div>
  );
};

/** Who follows / who they follow — tappable rows, straight to profiles. */
const FollowListSheet = ({ userId, kind, onClose, onOpen }) => {
  const { getToken } = useAuth();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    let live = true;
    const api = createApi(getToken);
    (kind === "Followers" ? api.followers(userId) : api.following(userId))
      .then(({ members }) => { if (live) setRows(members); })
      .catch(() => { if (live) setRows([]); });
    return () => { live = false; };
  }, [userId, kind, getToken]);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        height: "62dvh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>
            {kind}{rows ? ` · ${rows.length}` : ""}
          </span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px calc(14px + env(safe-area-inset-bottom))" }}>
          {!rows && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Loading…</div>}
          {rows && !rows.length && (
            <div style={{ padding: "30px 10px", textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              {kind === "Followers" ? "No followers yet." : "Not following anyone yet."}
            </div>
          )}
          {(rows || []).map(m => (
            <div key={m.id} onClick={() => onOpen(m.id)} style={{
              display: "flex", alignItems: "center", gap: 12, padding: "11px 0",
              borderBottom: `1px solid ${T.line}`, cursor: "pointer",
            }}>
              <Avatar initials={m.id} src={m.avatar_url ? mediaUrl(m.avatar_url) : null} size={42} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream }}>{m.name}</span>
                  {m.verified && <BadgeCheck size={14} color={T.gold} />}
                </div>
                <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  @{m.handle}{m.role ? ` · ${m.role}` : ""}
                </div>
              </div>
              <PillarTag name={m.pillar} />
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
};

const SavedSheet = ({ onClose, onOpen }) => {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState(null);
  useEffect(() => {
    let live = true;
    createApi(getToken).savedPosts()
      .then(({ posts }) => { if (live) setPosts(posts); })
      .catch(() => { if (live) setPosts([]); });
    return () => { live = false; };
  }, [getToken]);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, background: T.ink, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", borderBottom: `1px solid ${T.line}` }}>
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Saved posts</span>
        <X size={22} color={T.cream} style={{ cursor: "pointer" }} onClick={onClose} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        <PostGrid posts={posts} emptyTitle="Nothing saved yet"
          emptyHint="Tap the bookmark on any post to keep it here." onOpen={onOpen} />
      </div>
    </div>,
    document.body
  );
};

const QrSheet = ({ name, link, onClose }) => {
  const [dataUrl, setDataUrl] = useState(null);
  useEffect(() => {
    let live = true;
    import("qrcode").then(QR =>
      QR.toDataURL(link, { width: 480, margin: 1, color: { dark: "#17171B", light: "#F7F4EE" } })
        .then(url => { if (live) setDataUrl(url); })
    ).catch(() => {});
    return () => { live = false; };
  }, [link]);
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#000000C0", backdropFilter: "blur(4px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: 22, border: `1px solid ${T.line}`,
        padding: 26, textAlign: "center", width: "min(82vw, 320px)",
      }}>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 17, color: T.cream, marginBottom: 4 }}>{name}</div>
        <div style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 16 }}>Scan to open this profile in Connect</div>
        {dataUrl
          ? <img src={dataUrl} alt="Profile QR code" style={{ width: "100%", borderRadius: 14, border: `1px solid ${T.line}` }} />
          : <div style={{ padding: 40, fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Generating…</div>}
        <button onClick={onClose} style={{
          marginTop: 16, width: "100%", padding: "12px 0", borderRadius: 999, border: `1px solid ${T.line}`,
          background: "transparent", color: T.cream, cursor: "pointer",
          fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13.5,
        }}>Close</button>
      </div>
    </div>,
    document.body
  );
};

const btnGhost = () => ({
  flex: 1, padding: "10px 0", borderRadius: 10, border: `1px solid ${T.line}`,
  background: T.card, color: T.cream, fontFamily: "'Inter',sans-serif",
  fontWeight: 600, fontSize: 13.5, cursor: "pointer",
  display: "flex", alignItems: "center", justifyContent: "center",
});

/* ---------- AI concierge ---------- */
const QUICK_PROMPTS = [
  "How do I join FFG Digital?",
  "Find me a mentor",
  "What events are coming up?",
  "Send a message to the team",
];

const Concierge = ({ onClose }) => {
  const { getToken } = useAuth();
  const [msgs, setMsgs] = useState([
    { role: "assistant", content: "Welcome to FFG. I'm your concierge — I can help you find mentors, events and funding, or pass a message straight to the team. What do you need?" },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = React.useRef(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, busy]);

  const ask = async (text) => {
    if (!text.trim() || busy) return;
    const next = [...msgs, { role: "user", content: text.trim() }];
    setMsgs(next);
    setInput("");
    setBusy(true);
    try {
      /* The model call happens on our server. The browser never carries a
         provider key, and the system prompt is not shipped to the client. */
      const { reply } = await createApi(getToken).askConcierge(
        next.map(m => ({ role: m.role, content: m.content }))
      );
      setMsgs(m => [...m, { role: "assistant", content: reply || "I've logged that for the team — you'll hear back within one working day." }]);
    } catch (e) {
      setMsgs(m => [...m, { role: "assistant", content: "I couldn't reach the network just now, but I've saved your message locally — try me again in a moment." }]);
    }
    setBusy(false);
  };

  return (
    <div style={{ position: "absolute", inset: 0, zIndex: 45, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none", height: "78%",
        display: "flex", flexDirection: "column", overflow: "hidden",
      }}>
        {/* sheet header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
          <div style={{
            width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
            background: `linear-gradient(135deg, ${T.gold}30, ${T.ink})`,
            border: `1px solid ${T.gold}60`, display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <img src={T.logo} alt="" style={{ width: 20, height: 20 }} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Connect Concierge</span>
              <AgentMark size={13} />
            </div>
            <span style={{ fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif" }}>● Online — direct line to the group</span>
          </div>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        {/* messages */}
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 10 }}>
          {msgs.map((m, i) => (
            <div key={i} style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "82%", padding: "11px 14px", fontSize: 14, lineHeight: 1.5,
              fontFamily: "'Inter',sans-serif", color: m.role === "user" ? T.ink : T.cream,
              background: m.role === "user" ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
              border: m.role === "user" ? "none" : `1px solid ${T.line}`,
              borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
              whiteSpace: "pre-wrap",
            }}>{m.content}</div>
          ))}
          {busy && (
            <div style={{
              alignSelf: "flex-start", padding: "11px 16px", background: T.card,
              border: `1px solid ${T.line}`, borderRadius: "16px 16px 16px 4px",
              color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif",
            }}>Thinking…</div>
          )}
        </div>

        {/* quick prompts */}
        {msgs.length <= 1 && (
          <div style={{ display: "flex", gap: 8, padding: "6px 16px 10px", overflowX: "auto" }}>
            {QUICK_PROMPTS.map(q => (
              <button key={q} onClick={() => ask(q)} style={{
                flexShrink: 0, padding: "8px 14px", borderRadius: 999, cursor: "pointer",
                background: "transparent", border: `1px solid ${T.gold}50`,
                color: T.goldSoft, fontSize: 12.5, fontFamily: "'Inter',sans-serif", fontWeight: 500,
              }}>{q}</button>
            ))}
          </div>
        )}

        {/* input */}
        <div style={{ display: "flex", gap: 10, padding: "10px 14px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") ask(input); }}
            placeholder="Message the group…"
            style={{
              flex: 1, padding: "13px 16px", borderRadius: 999, outline: "none",
              background: T.card, border: `1px solid ${T.line}`, color: T.cream,
              fontSize: 14, fontFamily: "'Inter',sans-serif",
            }}
          />
          <button onClick={() => ask(input)} disabled={busy} style={{
            width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
            background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
            display: "flex", alignItems: "center", justifyContent: "center", opacity: busy ? 0.5 : 1,
          }}><Send size={18} color={T.ink} /></button>
        </div>
      </div>
    </div>
  );
};

/* ---------- articles ---------- */
const ArticleReader = ({ article, onBack, openUser }) => {
  /* Articles are published by the FFG team; the author may not be a member
     with a directory entry, so fall back to the house byline. */
  const author = USERS[article.author] || { name: "Forbes Family Group", role: "Editorial" };
  const { getToken } = useAuth();
  /* The shelf list travels light — the full text arrives when the reader
     opens. (This is also what records the read for the admin charts.) */
  const [body, setBody] = useState(article.body);
  const [meta, setMeta] = useState(null);          // { likes, liked, comments }
  const [commentsOpen, setCommentsOpen] = useState(false);
  useEffect(() => {
    let live = true;
    createApi(getToken).getArticle(article.id)
      .then(full => { if (live) { setBody(full.body || []); setMeta({ likes: full.likes || 0, liked: !!full.liked, comments: full.comments || 0 }); } })
      .catch(() => { if (live) { setBody(b => b || []); setMeta({ likes: 0, liked: false, comments: 0 }); } });
    return () => { live = false; };
  }, [article.id, getToken]);
  article = { ...article, body: body || [] };

  const shareArticle = () => {
    const link = `${window.location.origin}/?a=${encodeURIComponent(article.id)}`;
    if (navigator.share) navigator.share({ title: article.title, url: link }).catch(() => {});
    else navigator.clipboard?.writeText(link);
  };
  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Article</span>
        <Share2 size={19} color={T.cream} style={{ cursor: "pointer" }} onClick={shareArticle} />
      </div>
      <div style={{ flex: 1, overflowY: "auto" }}>
        {article.image && (
          <img src={article.image_url || EVENT_PICS[article.image]} alt="" style={{ width: "100%", display: "block" }} />
        )}
        <div style={{ padding: "20px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <PillarTag name={article.tag} />
            <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{article.read} read · {article.time}</span>
          </div>
          <h1 style={{ margin: "0 0 16px", fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 25, lineHeight: 1.2, color: T.cream }}>{article.title}</h1>
          {author && (
            <div onClick={() => openUser(author.id)} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, cursor: "pointer" }}>
              <Avatar initials={author.id} size={38} />
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.cream }}>{author.name}</span>
                  {author.verified && <BadgeCheck size={13} color={T.gold} />}
                </div>
                <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{author.role}</span>
              </div>
            </div>
          )}
          {article.ai && (
            <div style={{
              display: "flex", alignItems: "center", gap: 8, marginBottom: 20,
              background: `${T.gold}14`, border: `1px solid ${T.gold}40`, borderRadius: 12, padding: "10px 13px",
            }}>
              <AgentMark size={14} />
              <span style={{ fontSize: 12, color: T.goldSoft, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>Written live by FFG AI, just for you</span>
            </div>
          )}
          {article.body.map((para, i) => (
            <p key={i} style={{
              margin: "0 0 18px", fontSize: 15, lineHeight: 1.75, color: T.cream,
              fontFamily: "'Inter',sans-serif",
              ...(i === 0 ? { fontSize: 16, fontWeight: 500 } : {}),
            }}>{para}</p>
          ))}
        </div>
        <div style={{ padding: "0 20px 30px" }}>
          {/* real engagement — the demo's invented numbers are gone */}
          {meta && (
            <LikeRow likes={meta.likes} comments={meta.comments} liked={meta.liked}
              onToggle={() => createApi(getToken).likeArticle(article.id)}
              onComments={() => setCommentsOpen(true)} />
          )}
          {commentsOpen && (
            <CommentsSheet articleId={article.id} onClose={() => setCommentsOpen(false)}
              onCount={(n) => setMeta(m => m ? { ...m, comments: n } : m)} />
          )}
        </div>
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
};

/* ---------- library: watch · learn · read ---------- */

/**
 * How far the member got through each replay, 0–1, kept between visits so
 * "Continue watching" survives a reload. Enrolments are stored the same way.
 */
const readWatched = () => readJSON("ffg.watched") || {};
const saveWatched = (id, pct) => writeJSON("ffg.watched", { ...readWatched(), [id]: pct });
const readEnrolled = () => readJSON("ffg.enrolled") || [];

const LIB_TABS = [
  { id: "watch", label: "Watch", hint: "Past events", icon: Play },
  { id: "learn", label: "Learn", hint: "Live workshops", icon: GraduationCap },
  { id: "read", label: "Read", hint: "Articles", icon: BookOpen },
];

/** The shell every widget on this screen sits in. */
const Widget = ({ label, action, onAction, pad = 15, children }) => (
  <div style={{
    background: T.card, border: `1px solid ${T.line}`, borderRadius: 20,
    padding: pad, marginBottom: 12,
  }}>
    {(label || action) && (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <span style={{ fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 700, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{label}</span>
        {action && (
          <span onClick={onAction} style={{ fontSize: 12, fontWeight: 600, color: T.gold, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>{action}</span>
        )}
      </div>
    )}
    {children}
  </div>
);

/** Three numbers side by side — the smallest widget on the screen. */
const StatStrip = ({ items }) => (
  <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
    {items.map(s => (
      <div key={s.l} style={{
        flex: 1, background: T.card, border: `1px solid ${T.line}`, borderRadius: 16,
        padding: "13px 12px", textAlign: "center",
      }}>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 21, color: s.c || T.cream, lineHeight: 1.1 }}>{s.v}</div>
        <div style={{ fontSize: 10.5, color: T.dim, marginTop: 4, fontFamily: "'Inter',sans-serif", letterSpacing: "0.03em" }}>{s.l}</div>
      </div>
    ))}
  </div>
);

/** A filled track — reused for watch progress and for seats remaining. */
const Meter = ({ value, color, height = 5 }) => (
  <div style={{ height, borderRadius: 999, background: T.line, overflow: "hidden" }}>
    <div style={{
      width: `${Math.max(0, Math.min(1, value)) * 100}%`, height: "100%",
      borderRadius: 999, background: color || T.gold, transition: "width .3s ease",
    }} />
  </div>
);

const DurationChip = ({ children, icon: Ico }) => (
  <span style={{
    position: "absolute", right: 10, bottom: 10, display: "inline-flex", alignItems: "center", gap: 5,
    background: "rgba(23,23,27,0.82)", color: "#FFF", fontSize: 11, fontWeight: 600,
    padding: "4px 9px", borderRadius: 999, fontFamily: "'Inter',sans-serif",
  }}>{Ico && <Ico size={11} />}{children}</span>
);

const PlayBadge = ({ size = 52 }) => (
  <div style={{
    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
  }}>
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: "rgba(255,255,255,0.92)", display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 6px 20px rgba(0,0,0,0.25)",
    }}>
      <Play size={size * 0.4} color={T.cream} fill={T.cream} style={{ marginLeft: size * 0.05 }} />
    </div>
  </div>
);

/**
 * Replay viewer.
 *
 * There is no media file behind these yet — the timeline is a stand-in so the
 * surface can be reviewed. Position is real and is saved, so "Continue
 * watching" behaves correctly once actual recordings are wired in.
 */
const ReplayViewer = ({ replay, onBack, openUser }) => {
  const total = (parseInt(replay.duration, 10) || 45) * 60;
  const [pos, setPos] = useState(Math.round((readWatched()[replay.id] || 0) * total));
  const [playing, setPlaying] = useState(false);
  const { getToken } = useAuth();
  /* Real video: ask the API where to play from. Natively stored replays
     return a /media src that streams (with seeking) from our own storage;
     a legacy Stream uid returns a signed token instead. Replays without a
     video keep the poster timeline. */
  const [video, setVideo] = useState(null); // { kind: 'file'|'stream', src }
  useEffect(() => {
    if (!replay.has_video) return;
    let live = true;
    createApi(getToken).playReplay(replay.id)
      .then(({ src, token }) => {
        if (!live) return;
        if (src) setVideo({ kind: "file", src: mediaUrl(src) });
        else if (token) setVideo({ kind: "stream", src: `https://iframe.videodelivery.net/${token}` });
      })
      .catch(() => {});
    return () => { live = false; };
  }, [replay.id, replay.has_video, getToken]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => setPos(p => (p + 5 >= total ? total : p + 5)), 1000);
    return () => clearInterval(t);
  }, [playing, total]);

  useEffect(() => { saveWatched(replay.id, pos / total); }, [pos, total, replay.id]);

  const clock = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  const seek = stamp => {
    const [m, s] = stamp.split(":").map(Number);
    setPos(m * 60 + (s || 0));
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 30, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Replay</span>
        <Bookmark size={20} color={T.cream} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {video ? (
          <div style={{ position: "relative", background: "#000", aspectRatio: "16 / 9" }}>
            {video.kind === "file" ? (
              <video
                src={video.src}
                controls
                playsInline
                poster={replay.image_url || undefined}
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }}
              />
            ) : (
              <iframe
                src={video.src}
                title={replay.title}
                style={{ border: "none", position: "absolute", inset: 0, width: "100%", height: "100%" }}
                allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            )}
          </div>
        ) : (
        <div style={{ position: "relative", background: "#000" }}>
          <img src={replay.image_url || EVENT_PICS[replay.image]} alt="" style={{ width: "100%", display: "block", opacity: playing ? 0.55 : 0.85 }} />
          <div onClick={() => setPlaying(p => !p)} style={{ position: "absolute", inset: 0, cursor: "pointer" }}>
            {!playing && <PlayBadge size={62} />}
          </div>
          <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, padding: "10px 12px", background: "linear-gradient(transparent, rgba(0,0,0,0.65))" }}>
            <Meter value={pos / total} color="#FFF" height={4} />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 7 }}>
              <span onClick={() => setPlaying(p => !p)} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                {playing ? <Pause size={15} color="#FFF" /> : <Play size={15} color="#FFF" fill="#FFF" />}
                <span style={{ color: "#FFF", fontSize: 11.5, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{clock(pos)} / {replay.duration}</span>
              </span>
              {replay.views != null && <span style={{ color: "rgba(255,255,255,0.8)", fontSize: 11, fontFamily: "'Inter',sans-serif" }}>{replay.views} views</span>}
            </div>
          </div>
        </div>
        )}

        <div style={{ padding: "18px 20px 8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 11 }}>
            <PillarTag name={replay.tag} />
            <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Recorded {replay.date}</span>
          </div>
          <h1 style={{ margin: "0 0 12px", fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 23, lineHeight: 1.22, color: T.cream }}>{replay.title}</h1>
          <p style={{ margin: "0 0 20px", fontSize: 14.5, lineHeight: 1.65, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{replay.summary}</p>

          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 22 }}>
            {replay.speakers.map(uid => (
              <div key={uid} onClick={() => openUser(uid)} style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer" }}>
                <Avatar initials={uid} size={30} />
                <span style={{ fontSize: 12, color: T.cream, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{USERS[uid]?.name?.split(" ")[0] || uid}</span>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 700, color: T.dim, marginBottom: 10, fontFamily: "'Inter',sans-serif" }}>CHAPTERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 26 }}>
            {replay.chapters.map(([stamp, label]) => (
              <div key={stamp} onClick={() => seek(stamp)} style={{
                display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
                background: T.card, border: `1px solid ${T.line}`, borderRadius: 14, padding: "11px 13px",
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, fontFamily: "'Inter',sans-serif", minWidth: 42 }}>{stamp}</span>
                <span style={{ flex: 1, fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{label}</span>
                <Play size={13} color={T.dim} />
              </div>
            ))}
          </div>
        </div>
        <div style={{ height: 80 }} />
      </div>
    </div>
  );
};

/**
 * Watch — replays of events that have already run.
 *
 * `version` bumps every time the viewer closes, which is the cue to re-read
 * progress from storage: this screen stays mounted behind the viewer, so it
 * would otherwise show a stale bar.
 */
const WatchTab = ({ openReplay, version }) => {
  const [watched, setWatched] = useState(readWatched);
  useEffect(() => { setWatched(readWatched()); }, [version]);

  const inProgress = REPLAYS.filter(r => (watched[r.id] || 0) > 0.02 && (watched[r.id] || 0) < 0.97);
  const resume = inProgress[0];
  const finished = REPLAYS.filter(r => (watched[r.id] || 0) >= 0.97).length;
  const featured = REPLAYS[0];

  /* No recordings yet — the surface is built and switches on with the first
     published replay. */
  if (!featured) {
    return (
      <div style={{ padding: "28px 18px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 17, color: T.cream, marginBottom: 8 }}>No replays yet</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
          Recordings of FFG events will appear here after they happen.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 18px" }}>
      <StatStrip items={[
        { v: REPLAYS.length, l: "recordings" },
        { v: inProgress.length, l: "in progress", c: T.gold },
        { v: finished, l: "finished", c: T.community },
      ]} />

      {resume && (
        <Widget label="CONTINUE WATCHING" action="Clear" onAction={() => { writeJSON("ffg.watched", {}); setWatched({}); }}>
          <div onClick={() => openReplay(resume)} style={{ display: "flex", gap: 12, cursor: "pointer", alignItems: "center" }}>
            <div style={{ position: "relative", width: 96, height: 62, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
              <img src={resume.image_url || EVENT_PICS[resume.image]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              <PlayBadge size={26} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif", marginBottom: 7, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{resume.title}</div>
              <Meter value={watched[resume.id]} />
              <div style={{ fontSize: 11, color: T.dim, marginTop: 6, fontFamily: "'Inter',sans-serif" }}>{Math.round(watched[resume.id] * 100)}% · {resume.duration}</div>
            </div>
          </div>
        </Widget>
      )}

      {/* featured replay */}
      <div onClick={() => openReplay(featured)} style={{
        borderRadius: 20, overflow: "hidden", cursor: "pointer", marginBottom: 12,
        border: `1px solid ${T.line}`, background: T.card,
      }}>
        <div style={{ position: "relative" }}>
          <img src={featured.image_url || EVENT_PICS[featured.image]} alt="" style={{ width: "100%", display: "block" }} />
          <PlayBadge />
          <DurationChip icon={Clock}>{featured.duration}</DurationChip>
        </div>
        <div style={{ padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PillarTag name={featured.tag} />
            <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{featured.date} · {featured.views} views</span>
          </div>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 19, lineHeight: 1.25, color: T.cream, marginBottom: 6 }}>{featured.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{featured.summary}</div>
        </div>
      </div>

      {/* the rest, two up */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        {REPLAYS.slice(1).map(r => (
          <div key={r.id} onClick={() => openReplay(r)} style={{
            background: T.card, border: `1px solid ${T.line}`, borderRadius: 16,
            overflow: "hidden", cursor: "pointer",
          }}>
            <div style={{ position: "relative" }}>
              <img src={r.image_url || EVENT_PICS[r.image]} alt="" style={{ width: "100%", height: 96, objectFit: "cover", display: "block" }} />
              <PlayBadge size={34} />
              <DurationChip>{r.duration}</DurationChip>
            </div>
            <div style={{ padding: "11px 12px 13px" }}>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.35, color: T.cream, fontFamily: "'Inter',sans-serif", marginBottom: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
              <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{r.date} · {r.views} views</div>
            </div>
          </div>
        ))}
      </div>
      <div style={{ height: 90 }} />
    </div>
  );
};

/** Learn — live workshops, with seats that actually run out. */
const LearnTab = ({ openUser }) => {
  const [enrolled, setEnrolled] = useState(readEnrolled);
  useEffect(() => { writeJSON("ffg.enrolled", enrolled); }, [enrolled]);

  const toggle = id => setEnrolled(e => (e.includes(id) ? e.filter(x => x !== id) : [...e, id]));
  const live = WORKSHOPS.find(w => w.live);
  const upcoming = WORKSHOPS.filter(w => !w.live);
  // "90 min" and "2 hrs" both land in hours, multiplied by however many sessions.
  const hoursOf = w => {
    const n = parseInt(w.duration, 10) || 0;
    return (w.duration.includes("min") ? n / 60 : n) * w.sessions;
  };
  const hours = WORKSHOPS.filter(w => enrolled.includes(w.id)).reduce((n, w) => n + hoursOf(w), 0);

  return (
    <div style={{ padding: "0 18px" }}>
      <StatStrip items={[
        { v: enrolled.length, l: "enrolled", c: T.gold },
        { v: WORKSHOPS.length, l: "workshops" },
        { v: `${hours.toFixed(1)}h`, l: "of teaching", c: T.connect },
      ]} />

      {live && (
        <div style={{
          background: `linear-gradient(135deg, ${T.gold}18, ${T.connect}14)`,
          border: `1px solid ${T.gold}55`, borderRadius: 20, padding: 15, marginBottom: 12,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 11 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#D7263D", boxShadow: "0 0 0 4px rgba(215,38,61,0.18)" }} />
            <span style={{ fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>LIVE NOW</span>
          </div>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 18, lineHeight: 1.25, color: T.cream, marginBottom: 6 }}>{live.title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 13 }}>{live.blurb}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Avatar initials={live.host} size={32} onClick={() => openUser(live.host)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{USERS[live.host].name}</div>
              <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{live.seats.taken} in the room · {live.duration}</div>
            </div>
            <button onClick={() => toggle(live.id)} style={{
              border: "none", cursor: "pointer", borderRadius: 999, padding: "10px 18px",
              background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`, color: "#FFF",
              fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13,
            }}>{enrolled.includes(live.id) ? "Joined" : "Join"}</button>
          </div>
        </div>
      )}

      {/* upcoming workshops */}
      <div style={{ fontSize: 10.5, letterSpacing: "0.16em", fontWeight: 700, color: T.dim, margin: "6px 2px 10px", fontFamily: "'Inter',sans-serif" }}>UPCOMING</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {upcoming.map(w => {
          const left = w.seats.total - w.seats.taken;
          const isOn = enrolled.includes(w.id);
          return (
            <div key={w.id} style={{ background: T.card, border: `1px solid ${isOn ? `${T.gold}66` : T.line}`, borderRadius: 20, overflow: "hidden" }}>
              <div style={{ display: "flex", gap: 13, padding: 13 }}>
                <div style={{ width: 74, height: 74, borderRadius: 14, overflow: "hidden", flexShrink: 0 }}>
                  <img src={w.image_url || EVENT_PICS[w.image]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    <PillarTag name={w.tag} />
                    <span style={{ fontSize: 10.5, color: T.dim, fontWeight: 600, fontFamily: "'Inter',sans-serif" }}>{w.level.toUpperCase()}</span>
                  </div>
                  <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.3, color: T.cream, fontFamily: "'Inter',sans-serif", marginBottom: 5 }}>{w.title}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                    <Clock size={12} />{w.when} · {w.sessions === 1 ? "1 session" : `${w.sessions} sessions`} · {w.duration}
                  </div>
                </div>
              </div>

              <div style={{ padding: "0 13px 13px" }}>
                <div style={{ fontSize: 13, lineHeight: 1.55, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 12 }}>{w.blurb}</div>

                <div style={{ display: "flex", flexDirection: "column", gap: 7, marginBottom: 13 }}>
                  {w.outcomes.map(o => (
                    <div key={o} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Check size={13} color={T.community} strokeWidth={3} />
                      <span style={{ fontSize: 12.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{o}</span>
                    </div>
                  ))}
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.dim, marginBottom: 6, fontFamily: "'Inter',sans-serif" }}>
                    <span>{w.seats.taken} of {w.seats.total} seats taken</span>
                    <span style={{ color: left <= 5 ? "#D7263D" : T.dim, fontWeight: left <= 5 ? 700 : 400 }}>
                      {left <= 5 ? `Only ${left} left` : `${left} left`}
                    </span>
                  </div>
                  <Meter value={w.seats.taken / w.seats.total} color={left <= 5 ? "#D7263D" : T.gold} />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar initials={w.host} size={28} onClick={() => openUser(w.host)} />
                  <span style={{ flex: 1, fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Led by {USERS[w.host].name}</span>
                  <button onClick={() => toggle(w.id)} style={{
                    border: isOn ? `1px solid ${T.gold}` : "none", cursor: "pointer", borderRadius: 999,
                    padding: "9px 17px", fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5,
                    background: isOn ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
                    color: isOn ? T.gold : "#FFF",
                  }}>{isOn ? "Enrolled" : "Enrol"}</button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ height: 90 }} />
    </div>
  );
};

/**
 * Read — the editorial shelf.
 *
 * Read-only for members. Articles are published by the FFG team through the
 * admin API — members can no longer write pieces into the Library. The API
 * enforces this (admin-only POST); this screen simply has no compose surface.
 */
const ReadTab = ({ openArticle }) => {
  const minutes = ARTICLES.reduce((n, a) => n + (parseInt(a.read, 10) || 0), 0);

  /* Nothing published yet. The FFG team writes through the admin API; the
     shelf fills as pieces land. */
  if (!ARTICLES.length) {
    return (
      <div style={{ padding: "28px 18px", textAlign: "center" }}>
        <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 17, color: T.cream, marginBottom: 8 }}>Nothing to read yet</div>
        <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
          Editorial from the FFG team will appear here.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: "0 18px" }}>
      <StatStrip items={[
        { v: ARTICLES.length, l: "articles" },
        { v: `${minutes}m`, l: "of reading", c: T.connect },
        { v: new Set(ARTICLES.map(a => a.author)).size, l: "writers", c: T.community },
      ]} />

      {/* featured article */}
      <div onClick={() => openArticle(ARTICLES[0])} style={{
        borderRadius: 20, overflow: "hidden", cursor: "pointer", marginBottom: 12,
        border: `1px solid ${T.line}`, background: T.card,
      }}>
        <img src={ARTICLES[0].image_url || EVENT_PICS[ARTICLES[0].image]} alt="" style={{ width: "100%", display: "block" }} />
        <div style={{ padding: "15px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <PillarTag name={ARTICLES[0].tag} />
            <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{ARTICLES[0].read} · {ARTICLES[0].time}</span>
          </div>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 19, lineHeight: 1.25, color: T.cream, marginBottom: 6 }}>{ARTICLES[0].title}</div>
          <div style={{ fontSize: 13, lineHeight: 1.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{ARTICLES[0].excerpt}</div>
        </div>
      </div>

      {/* article list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ARTICLES.slice(1).map(a => {
          const author = USERS[a.author];
          return (
            <div key={a.id} onClick={() => openArticle(a)} style={{
              display: "flex", gap: 13, background: T.card, border: `1px solid ${T.line}`,
              borderRadius: 16, padding: 13, cursor: "pointer", alignItems: "center",
            }}>
              <div style={{ width: 86, height: 86, borderRadius: 12, overflow: "hidden", flexShrink: 0 }}>
                <img src={a.image_url || EVENT_PICS[a.image]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, lineHeight: 1.35, color: T.cream, marginBottom: 5, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{a.title}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Avatar initials={a.author} size={20} />
                  <span style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{author.name.split(" ")[0]} · {a.read} · {a.time}</span>
                </div>
              </div>
              <ChevronRight size={17} color={T.dim} style={{ flexShrink: 0 }} />
            </div>
          );
        })}
      </div>
      <div style={{ height: 90 }} />
    </div>
  );
};

/**
 * Library.
 *
 * Three shelves under one roof: Watch (recordings of past events), Learn
 * (live workshops with finite seats) and Read (editorial). The choice is
 * remembered, so a member who lives in Watch doesn't land on Read every time.
 */
const Articles = ({ openArticle, openReplay, openUser, member, watchVersion, shelfRequest }) => {
  const [shelf, setShelf] = useState(() => readFlag("ffg.libraryTab") || "watch");
  const pick = id => { setShelf(id); writeFlag("ffg.libraryTab", id); };
  const active = LIB_TABS.find(t => t.id === shelf) || LIB_TABS[0];

  // Search can land the member straight on a shelf. Each request carries a
  // nonce so asking for the same shelf twice still takes effect.
  useEffect(() => {
    if (shelfRequest?.shelf) pick(shelfRequest.shelf);
  }, [shelfRequest]);

  return (
    <div>
      <SectionTitle eyebrow="IDEAS FROM THE COMMUNITY" title="Library" />

      {/* shelf switch */}
      <div style={{ display: "flex", gap: 8, padding: "0 18px 16px" }}>
        {LIB_TABS.map(t => {
          const Ico = t.icon; const on = t.id === shelf;
          return (
            <div key={t.id} onClick={() => pick(t.id)} style={{
              flex: 1, cursor: "pointer", borderRadius: 16, padding: "11px 8px", textAlign: "center",
              background: on ? T.cream : T.card,
              border: `1px solid ${on ? T.cream : T.line}`,
              transition: "background .2s ease",
            }}>
              <Ico size={16} color={on ? T.ink : T.cream} style={{ marginBottom: 5 }} />
              <div style={{ fontSize: 13, fontWeight: 700, color: on ? T.ink : T.cream, fontFamily: "'Inter',sans-serif" }}>{t.label}</div>
              <div style={{ fontSize: 10, color: on ? "rgba(247,244,238,0.7)" : T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{t.hint}</div>
            </div>
          );
        })}
      </div>

      {active.id === "watch" && <WatchTab openReplay={openReplay} version={watchVersion} />}
      {active.id === "learn" && <LearnTab openUser={openUser} />}
      {active.id === "read" && <ReadTab openArticle={openArticle} />}
    </div>
  );
};


/* ---------- messaging + notifications ----------

   Sample conversations and notifications left with the sample cast. Real
   messaging lands when the threads/messages tables gain an API; until then
   both surfaces show their empty states honestly. */
const THREADS = [];
const THREAD_HISTORY = {};
const CANNED_REPLIES = [];
const NOTIFS = [];

const NOTIF_ICONS = { heart: Heart, match: AgentMark, follow: User, room: Radio, event: Calendar };
const NOTIF_COLORS = { heart: "community", match: "gold", follow: "connect", room: "gold", event: "community" };

const overlayTopBar = (title, onBack, right = null) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
    background: `${T.ink}F0`, backdropFilter: "blur(12px)",
  }}>
    <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
    <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{title}</span>
    {right || <span style={{ width: 24 }} />}
  </div>
);

const ChatView = ({ uid, onBack, openUser }) => {
  const u = USERS[uid] || { id: uid, name: "Member", role: "" };
  const { getToken } = useAuth();
  const [threadId, setThreadId] = useState(null);
  const [msgs, setMsgs] = useState([]);
  const [input, setInput] = useState("");
  const [typing] = useState(false); // nobody fakes typing any more
  const scrollRef = React.useRef(null);

  /* Open (or create) the thread, load its history, and keep polling while
     the chat is on screen so their replies arrive. */
  useEffect(() => {
    let live = true;
    let poll;
    const api = createApi(getToken);
    api.openThread(uid)
      .then(({ id }) => {
        if (!live) return;
        setThreadId(id);
        const load = () => api.listMessages(id)
          .then(({ messages }) => { if (live) setMsgs(messages); })
          .catch(() => {});
        load();
        poll = setInterval(load, 15_000); // fallback; the socket does the real-time
        const onRt = (e) => { if (e.detail?.type === "dm" && e.detail.thread === id) load(); };
        window.addEventListener("ffg:rt", onRt);
        cleanupRt = () => window.removeEventListener("ffg:rt", onRt);
      })
      .catch(() => {});
    let cleanupRt = null;
    return () => { live = false; if (poll) clearInterval(poll); cleanupRt && cleanupRt(); };
  }, [uid, getToken]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, typing]);

  const send = async () => {
    const text = input.trim();
    if (!text || !threadId) return;
    setInput("");
    setMsgs(m => [...m, { id: `tmp-${Date.now()}`, me: true, text }]); // optimistic
    try {
      await createApi(getToken).sendMessage(threadId, text);
    } catch {
      /* Put the words back rather than lose them. */
      setMsgs(m => m.filter(x => !String(x.id).startsWith('tmp-')));
      setInput(text);
    }
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: T.ink, zIndex: 995, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 11,
        padding: "12px 14px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <Avatar initials={uid} size={38} onClick={() => openUser(uid)} />
        <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openUser(uid)}>
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream }}>{u.name}</span>
            {u.verified && <BadgeCheck size={14} color={T.gold} />}
          </div>
          <span style={{ fontSize: 11.5, color: T.community, fontFamily: "'Inter',sans-serif" }}>● Active now</span>
        </div>
      </div>
      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "16px 16px 8px", display: "flex", flexDirection: "column", gap: 9 }}>
        {msgs.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.me ? "flex-end" : "flex-start",
            maxWidth: "80%", padding: "10px 14px", fontSize: 14, lineHeight: 1.5,
            fontFamily: "'Inter',sans-serif",
            color: m.me ? T.ink : T.cream,
            background: m.me ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            border: m.me ? "none" : `1px solid ${T.line}`,
            borderRadius: m.me ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
          }}>{m.text}</div>
        ))}
        {typing && (
          <div style={{
            alignSelf: "flex-start", padding: "12px 16px", background: T.card,
            border: `1px solid ${T.line}`, borderRadius: "16px 16px 16px 4px",
            color: T.dim, fontSize: 13, fontFamily: "'Inter',sans-serif",
          }}>typing…</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "10px 14px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          placeholder={`Message ${u.name.split(" ")[0]}…`}
          style={{
            flex: 1, padding: "13px 16px", borderRadius: 999, outline: "none",
            background: T.card, border: `1px solid ${T.line}`, color: T.cream,
            fontSize: 14, fontFamily: "'Inter',sans-serif",
          }} />
        <button onClick={send} style={{
          width: 46, height: 46, borderRadius: "50%", border: "none", cursor: "pointer", flexShrink: 0,
          background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Send size={18} color={T.ink} /></button>
      </div>
    </div>,
    document.body
  );
};

const MessagesScreen = ({ onBack, openChat, openUser }) => {
  const { getToken } = useAuth();
  const [threads, setThreads] = useState(null);

  /* Real conversations from the server, refreshed while the screen is open
     so an incoming message surfaces without a pull-to-refresh. */
  useEffect(() => {
    let live = true;
    const load = () => createApi(getToken).listThreads()
      .then(({ threads }) => { if (live) setThreads(threads); })
      .catch(() => { if (live) setThreads([]); });
    load();
    const poll = setInterval(load, 8_000);
    return () => { live = false; clearInterval(poll); };
  }, [getToken]);

  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: T.ink, zIndex: 990, display: "flex", flexDirection: "column" }}>
      {overlayTopBar("Messages", onBack)}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
        {(threads || []).map(t => (
          <div key={t.id} onClick={() => openChat(t.other.id)} style={{
            display: "flex", alignItems: "center", gap: 13, padding: "13px 18px", cursor: "pointer",
            borderBottom: `1px solid ${T.line}`,
          }}>
            <Avatar initials={t.other.id} src={t.other.avatar_url ? mediaUrl(t.other.avatar_url) : null}
              size={50} ring={t.unread ? T.gold : T.line} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 3 }}>
                <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: t.unread ? 800 : 600, fontSize: 14.5, color: T.cream }}>{t.other.name}</span>
              </div>
              <div style={{
                fontSize: 12.5, color: t.unread ? T.cream : T.dim, fontFamily: "'Inter',sans-serif",
                fontWeight: t.unread ? 600 : 400,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
              }}>{t.last ? (t.last_mine ? `You: ${t.last}` : t.last) : "Say hello"}</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5, flexShrink: 0 }}>
              <span style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{t.last_at ? sinceLabel(t.last_at) : ""}</span>
              {t.unread > 0 && (
                <span style={{
                  minWidth: 19, height: 19, borderRadius: 10, padding: "0 6px",
                  background: T.gold, color: T.ink, fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Inter',sans-serif",
                }}>{t.unread}</span>
              )}
            </div>
          </div>
        ))}
        {threads && !threads.length && (
          <div style={{ padding: "40px 24px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 16, color: T.cream, marginBottom: 7 }}>No conversations yet</div>
            <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              Open a member's profile and tap Message to start one.
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

/* ---------- search ---------- */
/**
 * One pass over everything the app already holds in memory: members, posts,
 * events, rooms and reads. Matching is a plain case-insensitive substring over
 * each record's own text plus, where it helps, the author's name — so
 * searching "Kemi" finds her posts as well as her profile.
 */
const runSearch = q => {
  const s = q.trim().toLowerCase();
  if (!s) return null;
  const hit = (...vals) => vals.filter(Boolean).join(" ").toLowerCase().includes(s);
  return {
    members: Object.values(USERS).filter(u => hit(u.name, u.handle, u.role, u.bio, u.pillar)),
    posts: POSTS.filter(p => hit(p.text, p.pillar, USERS[p.uid]?.name)),
    events: EVENTS.filter(e => hit(e.name, e.where, e.tag, e.about)),
    rooms: ROOMS.filter(r => hit(r.title, r.tag, r.desc, r.when)),
    reads: ARTICLES.filter(a => hit(a.title, a.excerpt, a.tag, USERS[a.author]?.name, ...(a.body || []))),
    replays: REPLAYS.filter(r => hit(r.title, r.summary, r.tag, ...r.speakers.map(uid => USERS[uid]?.name))),
    workshops: WORKSHOPS.filter(w => hit(w.title, w.blurb, w.tag, w.level, USERS[w.host]?.name, ...w.outcomes)),
  };
};

const SearchGroup = ({ label, children }) => (
  <>
    <div style={{
      fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700,
      fontFamily: "'Inter',sans-serif", padding: "16px 18px 8px",
    }}>{label}</div>
    {children}
  </>
);

const SearchRow = ({ icon, title, sub, onClick }) => (
  <div onClick={onClick} style={{
    display: "flex", alignItems: "center", gap: 13, padding: "11px 18px", cursor: "pointer",
  }}>
    {icon}
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{
        fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream,
        whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
      }}>{title}</div>
      {sub && (
        <div style={{
          fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2,
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>{sub}</div>
      )}
    </div>
    <ChevronRight size={17} color={T.dim} style={{ flexShrink: 0 }} />
  </div>
);

const SearchIconBadge = ({ children }) => (
  <div style={{
    width: 40, height: 40, borderRadius: 12, flexShrink: 0,
    background: T.card, border: `1px solid ${T.line}`,
    display: "flex", alignItems: "center", justifyContent: "center",
  }}>{children}</div>
);

const SearchScreen = ({ onBack, openUser, openRoom, openEvent, openArticle, openReplay, openLearn }) => {
  const [q, setQ] = useState("");
  const inputRef = React.useRef(null);
  useEffect(() => { inputRef.current?.focus(); }, []);

  const res = runSearch(q);
  const total = res
    ? res.members.length + res.posts.length + res.events.length + res.rooms.length
      + res.reads.length + res.replays.length + res.workshops.length
    : 0;

  return (
    <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 37, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "12px 14px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer", flexShrink: 0 }} onClick={onBack} />
        <div style={{
          flex: 1, display: "flex", alignItems: "center", gap: 9,
          background: T.card, border: `1px solid ${T.line}`, borderRadius: 999, padding: "9px 14px",
        }}>
          <Search size={17} color={T.dim} style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Search members, events, rooms, library…"
            style={{
              flex: 1, minWidth: 0, background: "none", border: "none", outline: "none",
              color: T.cream, fontSize: 14, fontFamily: "'Inter',sans-serif",
            }}
          />
          {q && (
            <X size={16} color={T.dim} style={{ cursor: "pointer", flexShrink: 0 }} onClick={() => { setQ(""); inputRef.current?.focus(); }} />
          )}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        {!res && (
          <div style={{ padding: "48px 32px", textAlign: "center" }}>
            <Search size={30} color={T.dim} />
            <div style={{ marginTop: 14, fontSize: 14, color: T.dim, fontFamily: "'Inter',sans-serif", lineHeight: 1.55 }}>
              Search across members, posts, events, rooms and library.
            </div>
          </div>
        )}

        {res && total === 0 && (
          <div style={{ padding: "48px 32px", textAlign: "center" }}>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 18, color: T.cream }}>
              No results for “{q.trim()}”
            </div>
            <div style={{ marginTop: 8, fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              Try a name, a pillar like Capital, or an event.
            </div>
          </div>
        )}

        {res && res.members.length > 0 && (
          <SearchGroup label="MEMBERS">
            {res.members.map(u => (
              <SearchRow
                key={u.id}
                icon={<Avatar initials={u.id} size={40} />}
                title={u.name}
                sub={u.role}
                onClick={() => openUser(u.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.rooms.length > 0 && (
          <SearchGroup label="ROOMS">
            {res.rooms.map(r => (
              <SearchRow
                key={r.id}
                icon={<SearchIconBadge><Radio size={18} color={r.live ? T.gold : T.dim} /></SearchIconBadge>}
                title={r.title}
                sub={r.live ? `● Live · ${r.listeners} listening` : r.when}
                onClick={() => openRoom(r.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.events.length > 0 && (
          <SearchGroup label="EVENTS">
            {res.events.map(e => (
              <SearchRow
                key={e.id}
                icon={<SearchIconBadge><Calendar size={18} color={T.gold} /></SearchIconBadge>}
                title={e.name}
                sub={`${e.date} ${e.month} · ${e.where}`}
                onClick={() => openEvent(e.id)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.replays.length > 0 && (
          <SearchGroup label="WATCH">
            {res.replays.map(r => (
              <SearchRow
                key={r.id}
                icon={<SearchIconBadge><Play size={18} color={T.gold} /></SearchIconBadge>}
                title={r.title}
                sub={`${r.date} · ${r.duration}`}
                onClick={() => openReplay(r)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.workshops.length > 0 && (
          <SearchGroup label="LEARN">
            {res.workshops.map(w => (
              <SearchRow
                key={w.id}
                icon={<SearchIconBadge><GraduationCap size={18} color={T.gold} /></SearchIconBadge>}
                title={w.title}
                sub={w.live ? `● Live now · ${USERS[w.host]?.name}` : `${w.when} · ${w.level}`}
                onClick={openLearn}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.reads.length > 0 && (
          <SearchGroup label="READ">
            {res.reads.map(a => (
              <SearchRow
                key={a.id}
                icon={<SearchIconBadge><BookOpen size={18} color={T.gold} /></SearchIconBadge>}
                title={a.title}
                sub={`${USERS[a.author]?.name || ""} · ${a.read}`}
                onClick={() => openArticle(a)}
              />
            ))}
          </SearchGroup>
        )}

        {res && res.posts.length > 0 && (
          <SearchGroup label="POSTS">
            {res.posts.map((p, i) => (
              <SearchRow
                key={i}
                icon={<Avatar initials={p.uid} size={40} />}
                title={USERS[p.uid]?.name || p.uid}
                sub={p.text}
                onClick={() => openUser(p.uid)}
              />
            ))}
          </SearchGroup>
        )}
      </div>
    </div>
  );
};

const NotificationsScreen = ({ onBack, openUser }) => (
  <div style={{ position: "absolute", inset: 0, background: T.ink, zIndex: 35, display: "flex", flexDirection: "column" }}>
    {overlayTopBar("Notifications", onBack)}
    <div style={{ flex: 1, overflowY: "auto", padding: "10px 0" }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "8px 18px 10px" }}>NEW</div>
      {NOTIFS.filter(n => n.unread).map((n, i) => <NotifRow key={i} n={n} openUser={openUser} />)}
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.dim, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "18px 18px 10px" }}>EARLIER</div>
      {NOTIFS.filter(n => !n.unread).map((n, i) => <NotifRow key={i} n={n} openUser={openUser} />)}
    </div>
  </div>
);

const NotifRow = ({ n, openUser }) => {
  const Ico = NOTIF_ICONS[n.icon];
  const col = T[NOTIF_COLORS[n.icon]];
  return (
    <div onClick={() => openUser(n.uid)} style={{
      display: "flex", alignItems: "center", gap: 13, padding: "12px 18px", cursor: "pointer",
      background: n.unread ? `${T.gold}0A` : "transparent",
    }}>
      <div style={{ position: "relative" }}>
        <Avatar initials={n.uid} size={46} />
        <div style={{
          position: "absolute", bottom: -3, right: -3, width: 20, height: 20, borderRadius: 10,
          background: col, border: `2px solid ${T.ink}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><Ico size={10} color={T.ink} strokeWidth={2.6} /></div>
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif", fontWeight: n.unread ? 600 : 400, lineHeight: 1.4 }}>{n.text}</div>
        <div style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{n.time} ago</div>
      </div>
      {n.unread && <span style={{ width: 8, height: 8, borderRadius: 4, background: T.gold, flexShrink: 0 }} />}
    </div>
  );
};

/* ---------- shell chrome ---------- */
const Header = ({ onBell, onSearch }) => (
  <div style={{
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "14px 18px 12px", position: "sticky", top: 0, zIndex: 10,
    background: `${T.ink}F0`, backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}`,
  }}>
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <img src={T.logo} alt="" style={{ width: 26, height: 26 }} />
      <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 15, color: T.cream, letterSpacing: "0.04em" }}>Connect</span>
    </div>
    <div style={{ display: "flex", gap: 18, color: T.cream, alignItems: "center" }}>
      <span onClick={onSearch} style={{ cursor: "pointer", display: "flex" }}>
        <Search size={21} strokeWidth={2} />
      </span>
      <div style={{ position: "relative", cursor: "pointer" }} onClick={onBell}>
        <Bell size={21} strokeWidth={2} />
        <span style={{ position: "absolute", top: -1, right: -1, width: 8, height: 8, borderRadius: 4, background: T.gold }} />
      </div>
    </div>
  </div>
);

/* ---------- screens ---------- */
/**
 * The briefing card. Dismissible — a card you cannot close stops being a
 * briefing and starts being furniture — and its copy no longer invents
 * matches and seat counts: it speaks to what the Concierge can actually do.
 * Dismissal persists until the member clears the app's storage.
 */
const AIBriefing = ({ openConcierge, member }) => {
  const [hidden, setHidden] = useState(() => readFlag("ffg.briefing.dismissed") === "1");
  if (hidden) return null;
  return (
    <div onClick={openConcierge} style={{
      margin: "14px 18px 2px", borderRadius: 18, padding: "15px 16px", cursor: "pointer",
      background: `linear-gradient(130deg, ${T.gold}1C, ${T.ink2} 65%)`,
      border: `1px solid ${T.gold}38`, display: "flex", gap: 12, alignItems: "flex-start",
    }}>
      <AgentMark size={17} style={{ marginTop: 2 }} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 5 }}>
          {member?.name ? `${member.name.split(" ")[0].toUpperCase()}, YOUR CONNECT CONCIERGE` : "YOUR CONNECT CONCIERGE"}
        </div>
        <div style={{ fontSize: 13.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
          Ask me anything — members to meet, events coming up, or a message
          passed straight to the FFG team.
        </div>
      </div>
      <X size={17} color={T.dim} style={{ flexShrink: 0, marginTop: 2, cursor: "pointer" }}
        onClick={(e) => { e.stopPropagation(); writeFlag("ffg.briefing.dismissed", "1"); setHidden(true); }} />
    </div>
  );
};

const LikeRow = ({ likes, comments, liked: likedInitial = false, onToggle, saved: savedInitial = false, onSave, onComments }) => {
  const [saved, setSaved] = useState(savedInitial);
  const toggleSave = async () => {
    if (!onSave) return;
    setSaved(s => !s);
    try {
      const res = await onSave();
      setSaved(res.saved);
    } catch { setSaved(savedInitial); }
  };
  /* Optimistic: flip locally, then let the server's answer correct us. A
     like that fails simply un-flips. */
  const [liked, setLiked] = useState(likedInitial);
  const [count, setCount] = useState(likes);
  const toggle = async () => {
    if (!onToggle) { setLiked(l => !l); return; }
    setLiked(l => !l);
    setCount(c => c + (liked ? -1 : 1));
    try {
      const res = await onToggle();
      setLiked(res.liked);
      setCount(res.likes);
    } catch {
      setLiked(likedInitial);
      setCount(likes);
    }
  };
  return (
    <div style={{ display: "flex", gap: 26, color: T.dim, alignItems: "center" }}>
      <span onClick={toggle} style={{
        display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'Inter',sans-serif",
        cursor: "pointer", color: liked ? T.gold : T.dim, fontWeight: liked ? 700 : 400,
        transition: "color 0.15s",
      }}>
        <Heart size={19} strokeWidth={2} fill={liked ? T.gold : "none"}
          style={{ transform: liked ? "scale(1.15)" : "none", transition: "transform 0.2s cubic-bezier(.3,1.6,.5,1)" }} />
        {count}
      </span>
      <span onClick={onComments} style={{
        display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontFamily: "'Inter',sans-serif",
        cursor: onComments ? "pointer" : "default",
      }}>
        <MessageCircle size={19} strokeWidth={2} />{comments}</span>
      <Share2 size={18} strokeWidth={2} />
      <Bookmark size={18} strokeWidth={2} onClick={toggleSave}
        color={saved ? T.gold : T.dim} fill={saved ? T.gold : "none"}
        style={{ marginLeft: "auto", cursor: onSave ? "pointer" : "default", transition: "color 0.15s" }} />
    </div>
  );
};

const LiveStrip = ({ openRoom }) => {
  const live = ROOMS.filter(r => r.live);
  return (
    <div style={{ padding: "16px 0 4px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 18px", marginBottom: 10 }}>
        <span style={{ width: 7, height: 7, borderRadius: 4, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />
        <span style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 700, fontFamily: "'Inter',sans-serif" }}>HAPPENING NOW IN ROOMS</span>
      </div>
      <div style={{ display: "flex", gap: 10, padding: "0 18px", overflowX: "auto" }}>
        {live.map(r => (
          <div key={r.id} onClick={() => openRoom(r.id)} style={{
            flexShrink: 0, width: 230, borderRadius: 16, padding: "13px 14px", cursor: "pointer",
            background: `linear-gradient(140deg, ${T[PILLAR[r.tag].k]}1E, ${T.card} 70%)`,
            border: `1px solid ${T[PILLAR[r.tag].k]}40`,
          }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: T.cream, lineHeight: 1.35, marginBottom: 10, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{r.title}</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex" }}>
                {r.speakers.slice(0, 3).map((uid, i) => (
                  <div key={uid} style={{ marginLeft: i === 0 ? 0 : -8 }}>
                    <Avatar initials={uid} size={26} ring={T.card} />
                  </div>
                ))}
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11.5, color: T.gold, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <Radio size={12} />{r.listeners}
              </span>
            </div>
          </div>
        ))}
      </div>
      <style>{`@keyframes ffgPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    </div>
  );
};

const SuggestedStrip = ({ openUser, selfId }) => {
  const { getToken } = useAuth();
  /* Seeded from the directory's followed_by_me, then kept honest by the
     server's answer to each toggle. */
  const [followed, setFollowed] = useState(() =>
    Object.fromEntries(Object.values(USERS).map(u => [u.id, !!u.followed_by_me])));
  const toggleFollow = async (uid) => {
    setFollowed(f => ({ ...f, [uid]: !f[uid] }));
    try {
      const { following } = await createApi(getToken).followMember(uid);
      setFollowed(f => ({ ...f, [uid]: following }));
    } catch {
      setFollowed(f => ({ ...f, [uid]: !f[uid] }));
    }
  };
  /* Real ML ordering: members ranked by embedding affinity — how close
     their bio/role/pillar vector sits to yours — people you already follow
     pushed to the back. Falls back to alphabetical until vectors exist. */
  const suggested = (SUGGESTED.length
    ? SUGGESTED
    : Object.values(USERS)
        .filter(u => u.id !== selfId)
        .sort((a, b) =>
          (a.followed_by_me === b.followed_by_me ? 0 : a.followed_by_me ? 1 : -1)
          || (b.affinity ?? -1) - (a.affinity ?? -1))
        .map(u => u.id));
  if (!suggested.length) return null;
  return (
    <div style={{ padding: "18px 0", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.dim, fontWeight: 700, fontFamily: "'Inter',sans-serif", padding: "0 18px", marginBottom: 12 }}>PEOPLE YOU SHOULD KNOW</div>
      <div style={{ display: "flex", gap: 10, padding: "0 18px", overflowX: "auto" }}>
        {suggested.map(uid => {
          const u = USERS[uid]; const on = !!followed[uid];
          if (!u) return null;
          return (
            <div key={uid} style={{
              flexShrink: 0, width: 138, borderRadius: 16, padding: "16px 12px 13px",
              background: T.card, border: `1px solid ${T.line}`,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center",
            }}>
              <Avatar initials={uid} size={58} ring={T.gold} onClick={() => openUser(uid)} />
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4 }}>
                  <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 12.5, color: T.cream }}>{u.name.split(" ")[0]} {u.name.split(" ")[1]?.[0]}.</span>
                  {u.verified && <BadgeCheck size={12} color={T.gold} />}
                </div>
                <div style={{ fontSize: 10.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2, display: "-webkit-box", WebkitLineClamp: 1, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{u.role.split("·")[0].trim()}</div>
              </div>
              <button onClick={() => toggleFollow(uid)} style={{
                width: "100%", padding: "8px 0", borderRadius: 999, cursor: "pointer",
                border: on ? `1px solid ${T.line}` : "none",
                background: on ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
                color: on ? T.dim : T.ink, fontSize: 12, fontWeight: 700, fontFamily: "'Inter',sans-serif",
              }}>{on ? "Following" : "Follow"}</button>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Post = ({ p, openUser, member, onDeleted }) => {
  const { getToken } = useAuth();
  const u = p.me ? null : USERS[p.uid];
  const name = p.me ? (member?.name || "You") : (u?.name || p.uid);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(p.comments || 0);
  const [ownMenu, setOwnMenu] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(p.text);
  const [gone, setGone] = useState(false);
  if (gone) return null;

  const destroy = async () => {
    setOwnMenu(false);
    if (!window.confirm("Delete this post? This can't be undone.")) return;
    try {
      await createApi(getToken).deletePost(p.id);
      setGone(true);
      onDeleted && onDeleted(p.id);
    } catch { /* still there; the server said no */ }
  };
  return (
    <div style={{ padding: "16px 18px", borderBottom: `1px solid ${T.line}` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 11 }}>
        <Avatar initials={p.me ? "LA" : p.uid} size={42} onClick={() => !p.me && openUser(p.uid)} />
        <div style={{ flex: 1, minWidth: 0, cursor: p.me ? "default" : "pointer" }} onClick={() => !p.me && openUser(p.uid)}>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream }}>{name}</span>
            {(p.me || u?.verified) && <BadgeCheck size={15} color={T.gold} />}
          </div>
          <span style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{p.time} ago</span>
        </div>
        <PillarTag name={p.pillar} />
        {p.me && p.id && (
          <div style={{ position: "relative" }}>
            <MoreHorizontal size={18} color={T.dim} style={{ cursor: "pointer" }} onClick={() => setOwnMenu(m => !m)} />
            {ownMenu && (
              <div style={{
                position: "absolute", right: 0, top: 24, zIndex: 5, minWidth: 130,
                background: T.ink2, border: `1px solid ${T.line}`, borderRadius: 12,
                boxShadow: "0 8px 26px #00000030", overflow: "hidden",
              }}>
                <div onClick={() => { setOwnMenu(false); setEditing(true); }} style={{
                  padding: "11px 15px", fontSize: 13.5, color: T.cream, cursor: "pointer",
                  fontFamily: "'Inter',sans-serif", fontWeight: 600,
                }}>Edit post</div>
                <div onClick={destroy} style={{
                  padding: "11px 15px", fontSize: 13.5, color: "#B3261E", cursor: "pointer",
                  fontFamily: "'Inter',sans-serif", fontWeight: 600, borderTop: `1px solid ${T.line}`,
                }}>Delete post</div>
              </div>
            )}
          </div>
        )}
      </div>

      <p style={{ margin: "0 0 12px", fontFamily: "'Inter',sans-serif", fontSize: 14.5, lineHeight: 1.55, color: T.cream }}>{text}</p>

      {/* imageUrl is a member upload served from /media; image is a stock key */}
      {(p.imageUrl || p.image) && (
        <div style={{ borderRadius: 16, overflow: "hidden", marginBottom: 12, border: `1px solid ${T.line}` }}>
          {isVideoUrl(p.imageUrl) ? (
            <video src={p.imageUrl} controls playsInline preload="metadata"
              style={{ width: "100%", display: "block", maxHeight: 420, background: "#000" }} />
          ) : (
            <img src={p.imageUrl || EVENT_PICS[p.image] || p.image} alt="" style={{ width: "100%", display: "block" }} />
          )}
        </div>
      )}

      {/* tagged people — Instagram's "with" line */}
      {p.tags?.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {p.tags.map(t => (
            <span key={t.id} onClick={() => openUser(t.id)} style={{
              fontSize: 12, fontWeight: 600, color: T.connect, cursor: "pointer",
              background: `${T.connect}12`, borderRadius: 999, padding: "4px 10px",
              fontFamily: "'Inter',sans-serif",
            }}>with {t.name}</span>
          ))}
        </div>
      )}

      {p.stat && (
        <div style={{
          background: `linear-gradient(120deg, ${T.gold}14, transparent)`, border: `1px solid ${T.gold}35`,
          borderRadius: 14, padding: "14px 16px", marginBottom: 12, display: "flex", alignItems: "baseline", gap: 10,
        }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 34, color: T.gold }}>{p.stat.value}</span>
          <span style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em" }}>{p.stat.label.toUpperCase()}</span>
        </div>
      )}

      {p.event && (
        <div style={{
          border: `1px solid ${T.line}`, background: T.ink2, borderRadius: 14, padding: "13px 15px",
          marginBottom: 12, display: "flex", alignItems: "center", gap: 12,
        }}>
          <Calendar size={20} color={T.community} />
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13.5, color: T.cream }}>{p.event.name}</div>
            <div style={{ fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{p.event.where} · {p.event.when}</div>
          </div>
          <ChevronRight size={18} color={T.dim} />
        </div>
      )}

      <LikeRow likes={p.likes} comments={commentCount} liked={p.liked}
        onToggle={p.id ? () => createApi(getToken).likePost(p.id) : null}
        saved={p.saved} onSave={p.id ? () => createApi(getToken).savePost(p.id) : null}
        onComments={p.id ? () => setCommentsOpen(true) : null} />

      {commentsOpen && (
        <CommentsSheet postId={p.id} onClose={() => setCommentsOpen(false)} onCount={setCommentCount} />
      )}
      {editing && (
        <EditPostSheet post={{ id: p.id, text }} onClose={() => setEditing(false)} onSaved={setText} />
      )}
    </div>
  );
};

const Composer = ({ member, onPost, onClose }) => {
  const [text, setText] = useState("");
  const [pic, setPic] = useState(null);          // stock image key
  const [upload, setUpload] = useState(null);    // { url, id } once stored
  const [tagged, setTagged] = useState([]);      // member ids tagged in this post
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [postState, setPostState] = useState("idle"); // idle | posting | done | error
  const [preview, setPreview] = useState(null);  // local object URL, shown instantly
  const [isVid, setIsVid] = useState(false);     // the preview is a video
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const fileRef = React.useRef(null);
  const { getToken } = useAuth();

  // Revoke the object URL when it changes or the composer closes, or the
  // browser holds the blob in memory for the life of the document.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pickFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";                  // let the same file be re-picked after an error
    if (!file) return;

    const problem = validateMedia(file);  // photos AND video clips
    if (problem) { setErr(problem); return; }

    setErr(null);
    setPic(null);                          // an upload replaces any stock pick
    setIsVid(isVideoFile(file));
    setPreview(URL.createObjectURL(file));
    setBusy(true);
    try {
      const saved = await createApi(getToken).uploadImage(file, { kind: "post" });
      // Absolute, so the image also resolves when the app is served from a
      // different origin than the API (the Vercel build).
      setUpload({ ...saved, url: mediaUrl(saved.url) });
    } catch (e2) {
      setErr(e2.message || "Upload failed. Please try again.");
      setPreview(p => { if (p) URL.revokeObjectURL(p); return null; });
    } finally {
      setBusy(false);
    }
  };

  const clearUpload = () => {
    setIsVid(false);
    setPreview(p => { if (p) URL.revokeObjectURL(p); return null; });
    setUpload(null);
    setErr(null);
  };

  const canPost = (text.trim() || pic || upload) && !busy;

  return createPortal(
    /* A portal to <body>: rendered inside the profile screen this sheet was
       trapped under that screen's stacking context, and the bottom tab bar
       painted OVER the Post button — invisible, unpressable. From <body>,
       position:fixed, nothing outranks it. The Post button lives in a pinned
       footer, so it can never fall off the bottom of a phone either. */
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        maxHeight: "88dvh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 18px 12px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>New post</span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 18px", WebkitOverflowScrolling: "touch" }}>
        <div style={{ display: "flex", gap: 11, marginBottom: 14 }}>
          <Avatar initials="LA" size={40} />
          <textarea value={text} onChange={e => setText(e.target.value)} rows={3} autoFocus
            placeholder="Share something with the community…"
            style={{
              flex: 1, padding: "12px 14px", borderRadius: 14, outline: "none", resize: "none",
              background: T.card, border: `1px solid ${T.line}`, color: T.cream,
              fontSize: 14.5, lineHeight: 1.5, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
            }} />
        </div>
        <div style={{ fontSize: 11, letterSpacing: "0.12em", color: T.dim, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>ADD A PHOTO</div>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES}
          onChange={pickFile}
          style={{ display: "none" }}
        />

        {preview ? (
          <div style={{ position: "relative", marginBottom: 12 }}>
            {isVid ? (
              <video src={preview} muted playsInline controls={!busy} style={{
                width: "100%", maxHeight: 190, objectFit: "cover",
                borderRadius: 14, border: `1px solid ${T.line}`,
                opacity: busy ? 0.55 : 1, transition: "opacity 0.2s",
              }} />
            ) : (
            <img src={preview} alt="" style={{
              width: "100%", maxHeight: 190, objectFit: "cover",
              borderRadius: 14, border: `1px solid ${T.line}`,
              opacity: busy ? 0.55 : 1, transition: "opacity 0.2s",
            }} />
            )}
            {busy && (
              <div style={{
                position: "absolute", inset: 0, display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 12.5, fontWeight: 700, color: T.cream,
                fontFamily: "'Inter',sans-serif",
              }}>Uploading…</div>
            )}
            {!busy && (
              <button onClick={clearUpload} aria-label="Remove photo" style={{
                position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14,
                border: "none", cursor: "pointer", background: "#00000099",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}><X size={16} color="#FFF" /></button>
            )}
          </div>
        ) : (
          <button onClick={() => fileRef.current?.click()} style={{
            width: "100%", padding: "13px 0", marginBottom: 12, borderRadius: 14,
            border: `1px dashed ${T.gold}80`, background: `${T.gold}0E`, cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            color: T.gold, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
          }}>
            <ImagePlus size={17} />Add a photo or video
          </button>
        )}

        {err && (
          <div style={{
            marginBottom: 12, padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
            lineHeight: 1.45, fontFamily: "'Inter',sans-serif",
            background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
          }}>{err}</div>
        )}

        <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 9 }}>
          or pick one of ours
        </div>
        <div style={{ display: "flex", gap: 8, overflowX: "auto", marginBottom: 16 }}>
          {Object.keys(EVENT_PICS).map(k => (
            <div key={k} onClick={() => { clearUpload(); setPic(p => p === k ? null : k); }} style={{
              flexShrink: 0, width: 82, height: 60, borderRadius: 10, overflow: "hidden", cursor: "pointer",
              border: pic === k ? `2.5px solid ${T.gold}` : `1px solid ${T.line}`,
              opacity: pic && pic !== k ? 0.45 : 1, transition: "all 0.15s",
            }}>
              <img src={EVENT_PICS[k]} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </div>
          ))}
        </div>
        {/* Tag people — Instagram's "with". Chips toggle; capped at 10. */}
        <div style={{ marginBottom: 12 }}>
          <button onClick={() => setShowTagPicker(s => !s)} style={{
            border: `1px solid ${tagged.length ? T.gold : T.line}`, background: tagged.length ? `${T.gold}12` : "transparent",
            borderRadius: 999, padding: "8px 14px", cursor: "pointer",
            fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12.5,
            color: tagged.length ? T.goldSoft : T.dim,
          }}>
            {tagged.length
              ? `With ${tagged.map(id => USERS[id]?.name?.split(" ")[0] || id).join(", ")}`
              : "Tag people"}
          </button>
          {showTagPicker && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 9 }}>
              {Object.values(USERS).filter(u => u.id !== member?.id).map(u => {
                const on = tagged.includes(u.id);
                return (
                  <button key={u.id}
                    onClick={() => setTagged(t => on ? t.filter(x => x !== u.id) : t.length < 10 ? [...t, u.id] : t)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, cursor: "pointer",
                      border: `1px solid ${on ? T.gold : T.line}`, background: on ? `${T.gold}14` : T.card,
                      borderRadius: 999, padding: "5px 11px 5px 5px",
                      fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 12,
                      color: on ? T.goldSoft : T.cream,
                    }}>
                    <Avatar initials={u.id} src={u.avatar_url} size={22} />
                    {u.name.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        </div>{/* end scrollable body */}

        {/* pinned footer — always on screen */}
        <div style={{ padding: "12px 18px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, flexShrink: 0, background: T.ink2 }}>
        {postState === "error" && (
          <div style={{
            marginBottom: 12, padding: "9px 12px", borderRadius: 10, fontSize: 12.5,
            fontFamily: "'Inter',sans-serif", lineHeight: 1.45,
            background: "rgba(200,60,60,0.10)", border: "1px solid rgba(200,60,60,0.35)", color: "#B4483F",
          }}>That didn't post. Check your connection and try again.</div>
        )}
        <button
          disabled={!canPost || postState === "posting" || postState === "done"}
          onClick={async () => {
            /* The parent talks to the API; this sheet hands over the words,
               the storage key of the uploaded media, and the tags — then
               waits, so the member sees it land rather than hoping. */
            setPostState("posting");
            try {
              await onPost({
                text: text.trim() || "📸",
                imageKey: upload?.url ? upload.url.replace(/^.*\/media\//, "") : null,
                tags: tagged,
              });
              setPostState("done");
              setTimeout(onClose, 900); // long enough to read "Posted ✓"
            } catch {
              setPostState("error");
            }
          }}
          style={{
            width: "100%", padding: "15px 0", borderRadius: 999, border: "none",
            cursor: canPost && postState === "idle" ? "pointer" : "default",
            background: postState === "done"
              ? T.community
              : canPost ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            color: canPost || postState === "done" ? "#FFF" : T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
            transition: "background 0.25s",
          }}>
          {busy ? "Uploading media…"
            : postState === "posting" ? "Posting…"
            : postState === "done" ? "Posted ✓"
            : postState === "error" ? "Try again"
            : "Post to the feed"}
        </button>
        </div>{/* end pinned footer */}
      </div>
    </div>,
    document.body
  );
};

/**
 * Comments on one post. A portal sheet: list scrolls, the input is pinned.
 * Deleting is offered on your own comments (and any comment under your own
 * post — your page, your rules; the API enforces the same).
 */
const CommentsSheet = ({ postId, articleId, onClose, onCount }) => {
  const { getToken } = useAuth();
  const [comments, setComments] = useState(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = React.useRef(null);

  /* One sheet, two homes: post comments and article comments share the
     exact same contract, so the only difference is which endpoints. */
  const io = React.useMemo(() => {
    const api = createApi(getToken);
    return articleId
      ? { load: () => api.articleComments(articleId), add: (t) => api.addArticleComment(articleId, t), del: (id) => api.deleteArticleComment(id) }
      : { load: () => api.listComments(postId), add: (t) => api.addComment(postId, t), del: (id) => api.deleteComment(id) };
  }, [postId, articleId, getToken]);

  useEffect(() => {
    let live = true;
    io.load()
      .then(({ comments }) => { if (live) { setComments(comments); onCount?.(comments.length); } })
      .catch(() => { if (live) setComments([]); });
    return () => { live = false; };
  }, [io]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [comments]);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    try {
      const created = await io.add(text);
      setComments(c => { const next = [...(c || []), created]; onCount?.(next.length); return next; });
      setInput("");
    } catch { /* the words stay in the box */ }
    setBusy(false);
  };

  const remove = async (id) => {
    try {
      await io.del(id);
      setComments(c => { const next = c.filter(x => x.id !== id); onCount?.(next.length); return next; });
    } catch { /* row stays if the server said no */ }
  };

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        height: "70dvh", display: "flex", flexDirection: "column",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 18px 10px", flexShrink: 0 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>
            Comments{comments ? ` · ${comments.length}` : ""}
          </span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", padding: "4px 18px" }}>
          {!comments && <div style={{ padding: 20, textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Loading…</div>}
          {comments && !comments.length && (
            <div style={{ padding: "30px 10px", textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              No comments yet — say something first.
            </div>
          )}
          {(comments || []).map(c => (
            <div key={c.id} style={{ display: "flex", gap: 10, padding: "9px 0", borderBottom: `1px solid ${T.line}` }}>
              <Avatar initials={c.uid} src={c.author.avatar_url ? mediaUrl(c.author.avatar_url) : null} size={32} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.cream, fontFamily: "'Inter',sans-serif", marginRight: 7 }}>{c.author.name}</span>
                <span style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{sinceLabel(c.at)}</span>
                <div style={{ fontSize: 13.5, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{c.text}</div>
              </div>
              {c.mine && (
                <X size={15} color={T.dim} style={{ cursor: "pointer", flexShrink: 0, marginTop: 3 }} onClick={() => remove(c.id)} />
              )}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 9, padding: "10px 18px calc(14px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, flexShrink: 0, background: T.ink2 }}>
          <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()}
            placeholder="Add a comment…" style={{
              flex: 1, padding: "12px 15px", borderRadius: 999, outline: "none",
              background: T.card, border: `1px solid ${T.line}`, color: T.cream,
              fontSize: 14, fontFamily: "'Inter',sans-serif",
            }} />
          <button onClick={send} disabled={!input.trim() || busy} style={{
            padding: "0 18px", borderRadius: 999, border: "none",
            cursor: input.trim() && !busy ? "pointer" : "default",
            background: input.trim() ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
            color: input.trim() ? "#FFF" : T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
          }}>{busy ? "…" : "Post"}</button>
        </div>
      </div>
    </div>,
    document.body
  );
};

/** Edit your own post's words — media stays as posted. */
const EditPostSheet = ({ post, onClose, onSaved }) => {
  const { getToken } = useAuth();
  const [text, setText] = useState(post.text);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      await createApi(getToken).updatePost(post.id, body);
      onSaved(body);
      onClose();
    } catch { setBusy(false); }
  };
  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
      <div onClick={onClose} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
      <div style={{
        position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
        border: `1px solid ${T.line}`, borderBottom: "none",
        padding: "18px 18px calc(18px + env(safe-area-inset-bottom))",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16, color: T.cream }}>Edit post</span>
          <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={onClose} />
        </div>
        <textarea value={text} onChange={e => setText(e.target.value)} rows={4} autoFocus style={{
          width: "100%", padding: "12px 14px", borderRadius: 14, outline: "none", resize: "none",
          background: T.card, border: `1px solid ${T.line}`, color: T.cream,
          fontSize: 14.5, lineHeight: 1.5, fontFamily: "'Inter',sans-serif", boxSizing: "border-box",
          marginBottom: 14,
        }} />
        <button onClick={save} disabled={!text.trim() || busy} style={{
          width: "100%", padding: "15px 0", borderRadius: 999, border: "none",
          cursor: text.trim() && !busy ? "pointer" : "default",
          background: text.trim() ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : T.card,
          color: text.trim() ? "#FFF" : T.dim,
          fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
        }}>{busy ? "Saving…" : "Save changes"}</button>
      </div>
    </div>,
    document.body
  );
};

/** "3h" from a timestamp — the feed's idea of time. */
const sinceLabel = (at) => {
  const mins = Math.max(1, (Date.now() - new Date(at).getTime()) / 60_000);
  if (mins < 60) return `${Math.round(mins)}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 60 / 24)}d`;
};

const shapeFeedPost = (p, myId) => ({
  id: p.id, uid: p.uid, me: p.uid === myId,
  time: sinceLabel(p.posted_at), pillar: p.pillar, text: p.text,
  imageUrl: p.image_url ? mediaUrl(p.image_url) : null, image: null,
  likes: p.likes, liked: p.liked, saved: p.saved, comments: 0, stat: p.stat, tags: p.tags || [],
});

/* ------------------------------------------------------------- web push */

const b64ToUint8 = (b64) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};

const pushSupported = () =>
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

/** Ask, register the worker, subscribe, and hand the subscription to the API. */
async function enablePush(getToken) {
  if (!pushSupported()) {
    throw new Error("On iPhone, add Connect to your Home Screen first (Share → Add to Home Screen), then try again from there.");
  }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notifications were not allowed.");
  const reg = await navigator.serviceWorker.register("/sw.js");
  const { key } = await createApi(getToken).pushKey();
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: b64ToUint8(key),
  });
  await createApi(getToken).pushSubscribe(sub.toJSON());
  localStorage.setItem("ffg.push.on", "1");
}

/**
 * The first-week card: three things that make membership feel alive, each
 * ticking itself off from real state. Dismissible; gone for good once all
 * three are done.
 */
const GettingStarted = ({ member, posts, getToken }) => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("ffg.checklist.done") === "1");
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOn, setPushOn] = useState(() =>
    localStorage.getItem("ffg.push.on") === "1" ||
    (typeof Notification !== "undefined" && Notification.permission === "granted"));

  const items = [
    {
      id: "push", done: pushOn, label: "Turn on notifications",
      sub: "Hear about messages and event reminders",
      action: async () => {
        if (pushBusy || pushOn) return;
        setPushBusy(true);
        try { await enablePush(getToken); setPushOn(true); }
        catch (e) { window.alert(e.message); }
        finally { setPushBusy(false); }
      },
    },
    {
      id: "rsvp", done: EVENTS.some(e => e.attending), label: "Reserve a seat at an event",
      sub: "The Events tab has what's coming up",
    },
    {
      id: "post", done: (posts || []).some(p => p.me), label: "Say hello in the feed",
      sub: "Introduce yourself to the community",
    },
  ];
  const remaining = items.filter(i => !i.done).length;
  if (dismissed || remaining === 0) return null;

  return (
    <div style={{
      margin: "12px 18px 0", background: T.card, border: `1px solid ${T.gold}55`,
      borderRadius: 18, padding: "14px 16px",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 14.5, color: T.cream }}>
          Getting started
        </span>
        <span onClick={() => { localStorage.setItem("ffg.checklist.done", "1"); setDismissed(true); }}
              style={{ fontSize: 12, color: T.dim, cursor: "pointer", fontFamily: "'Inter',sans-serif" }}>
          Dismiss
        </span>
      </div>
      {items.map(item => (
        <div key={item.id} onClick={item.action} style={{
          display: "flex", alignItems: "center", gap: 11, padding: "8px 0",
          cursor: item.action && !item.done ? "pointer" : "default",
          opacity: item.done ? 0.55 : 1,
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: "50%", flexShrink: 0,
            border: `1.5px solid ${item.done ? T.community : T.line}`,
            background: item.done ? `${T.community}18` : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {item.done && <Check size={13} color={T.community} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13.5, fontWeight: 600, color: T.cream, fontFamily: "'Inter',sans-serif",
              textDecoration: item.done ? "line-through" : "none",
            }}>
              {item.id === "push" && pushBusy ? "Turning on…" : item.label}
            </div>
            <div style={{ fontSize: 11.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 1 }}>{item.sub}</div>
          </div>
          {item.action && !item.done && <ChevronRight size={15} color={T.gold} />}
        </div>
      ))}
    </div>
  );
};

const Feed = ({ openUser, openConcierge, openRoom, member }) => {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState(null); // null = loading
  const [composing, setComposing] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => createApi(getToken).listPosts()
      .then(({ posts }) => { if (live) setPosts(posts.map(p => shapeFeedPost(p, member?.id))); })
      .catch(() => { if (live) setPosts(p => p || []); });
    load();
    // Someone posted or commented → the feed refreshes itself, live.
    const onRt = (e) => {
      if ((e.detail?.type === "post" || e.detail?.type === "comment") && e.detail.from !== member?.id) load();
    };
    window.addEventListener("ffg:rt", onRt);
    return () => { live = false; window.removeEventListener("ffg:rt", onRt); };
  }, [getToken, member?.id]);

  const publish = async ({ text, imageKey, tags }) => {
    const created = await createApi(getToken).createPost({
      body: text, pillar: 'Community', image_key: imageKey || undefined, tags,
    });
    setPosts(prev => [shapeFeedPost(created, member?.id), ...(prev || [])]);
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  return (
    <div>
      <div style={{ padding: "16px 18px 0", fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 22, color: T.cream }}>
        {greet}{member?.name ? `, ${member.name.split(" ")[0]}` : ""}.
      </div>
      <AIBriefing openConcierge={openConcierge} member={member} />
      <GettingStarted member={member} posts={posts} getToken={getToken} />

      {/* composer bar */}
      <div onClick={() => setComposing(true)} style={{
        margin: "12px 18px 0", display: "flex", alignItems: "center", gap: 11, cursor: "pointer",
        background: T.card, border: `1px solid ${T.line}`, borderRadius: 999, padding: "10px 14px",
      }}>
        <Avatar initials={(member?.name || "").split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase() || "ME"} size={34} />
        <span style={{ flex: 1, fontSize: 13.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>Share something with the community…</span>
        <ImagePlus size={19} color={T.gold} />
      </div>

      <LiveStrip openRoom={openRoom} />

      {(posts || []).slice(0, 2).map((p, i) => <Post key={p.id || i} p={p} openUser={openUser} member={member} />)}
      <SuggestedStrip openUser={openUser} selfId={member?.id} />
      {(posts || []).slice(2).map((p, i) => <Post key={p.id || (i + 2)} p={p} openUser={openUser} member={member} />)}
      {posts && !posts.length && (
        <div style={{ padding: "26px 18px", textAlign: "center" }}>
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 16, color: T.cream, marginBottom: 7 }}>The floor is yours</div>
          <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
            No posts yet — be the first to share something with the community.
          </div>
        </div>
      )}
      <div style={{ height: 90 }} />

      {composing && <Composer member={member} onClose={() => setComposing(false)}
        onPost={publish} />}
    </div>
  );
};


const SectionTitle = ({ eyebrow, title }) => (
  <div style={{ padding: "22px 18px 14px" }}>
    <div style={{ fontSize: 11, letterSpacing: "0.18em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 6 }}>{eyebrow}</div>
    <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 26, color: T.cream, letterSpacing: "-0.01em" }}>{title}</div>
  </div>
);

const Connect = ({ openUser }) => (
  <div>
    {/* The real membership. This is the point of the tab now the sample
        cast is gone: every card is a person who can actually be met. */}
    <SectionTitle eyebrow="MEET · THE NETWORK" title="Members" />
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 10 }}>
      {Object.values(USERS).map(u => (
        <div key={u.id} onClick={() => openUser(u.id)} style={{
          display: "flex", gap: 12, alignItems: "center", cursor: "pointer",
          background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "13px 14px",
        }}>
          <Avatar initials={u.id} src={u.avatar_url} size={46} ring={T.line} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream }}>{u.name}</span>
              {u.verified && <BadgeCheck size={15} color={T.gold} />}
            </div>
            <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {u.role || `@${u.handle}`}
            </div>
          </div>
          <PillarTag name={u.pillar} />
        </div>
      ))}
      {!Object.keys(USERS).length && (
        <div style={{ padding: "20px 0", textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
          Loading the directory…
        </div>
      )}
    </div>

    {/* AI matching returns when there are enough members for it to mean
        something — an empty heading over nothing would just look broken. */}
    {MATCHES.length > 0 && <SectionTitle eyebrow="MEET · AI MATCHING" title="Made for you this week" />}
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {MATCHES.map(m => {
        const u = USERS[m.uid];
        if (!u) return null;
        return (
          <div key={m.uid} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16 }}>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <Avatar initials={m.uid} size={50} ring={T.connect} onClick={() => openUser(m.uid)} />
              <div style={{ flex: 1, cursor: "pointer" }} onClick={() => openUser(m.uid)}>
                <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>{u.name}</div>
                <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>{u.role}</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 20, color: T.connect }}>{m.score}</div>
                <div style={{ fontSize: 9.5, color: T.dim, letterSpacing: "0.1em" }}>MATCH</div>
              </div>
            </div>
            <div style={{
              marginTop: 12, display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, color: T.connect,
              fontFamily: "'Inter',sans-serif", background: `${T.connect}12`, padding: "8px 12px", borderRadius: 10,
            }}><AgentMark size={14} color={T.connect} />{m.why}</div>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button style={{
                flex: 1, padding: "11px 0", borderRadius: 999, border: "none", background: T.gold,
                fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.ink, cursor: "pointer",
              }}>Say hello</button>
              <button onClick={() => openUser(m.uid)} style={{
                flex: 1, padding: "11px 0", borderRadius: 999, border: `1px solid ${T.line}`, background: "transparent",
                fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13.5, color: T.cream, cursor: "pointer",
              }}>View profile</button>
            </div>
          </div>
        );
      })}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

const Events = ({ openEvent }) => (
  <div>
    <SectionTitle eyebrow="150+ HOSTED" title="Upcoming events" />
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {EVENTS.map(e => (
        <div key={e.id} onClick={() => openEvent(e.id)} style={{ display: "flex", gap: 14, background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, alignItems: "center", cursor: "pointer" }}>
          <div style={{
            width: 54, height: 60, borderRadius: 14, background: T.ink2, border: `1px solid ${T.line}`,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0,
            overflow: "hidden",
          }}>
            <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: String(e.date).length > 2 ? 17 : 21, color: T.gold }}>{e.date}</span>
            {/* Months arrive as free text ("September") — the tile fits three letters. */}
            <span style={{ fontSize: 10, letterSpacing: "0.12em", color: T.dim, textTransform: "uppercase" }}>{String(e.month || "").slice(0, 3)}</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5, color: T.cream, marginBottom: 3 }}>{e.name}</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              <MapPin size={12} />{e.where}</div>
            <div style={{ marginTop: 7 }}><PillarTag name={e.tag} /></div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
            <div style={{ fontSize: 11.5, color: e.spots.includes("left") ? T.community : T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>{e.spots}</div>
            <ChevronRight size={17} color={T.dim} />
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

const EventDetail = ({ event, onBack, openUser, member }) => {
  const { getToken } = useAuth();
  const [rsvp, setRsvp] = useState(!!event.attending);
  const [confirming, setConfirming] = useState(false);
  const [showTicket, setShowTicket] = useState(false);
  const [payBusy, setPayBusy] = useState(false);
  const [going, setGoing] = useState(null); // { attendees, count } — the real list
  const host = USERS[event.host] || null;
  const priced = !!event.price_pence;
  const priceLabel = priced ? `£${(event.price_pence / 100).toFixed(event.price_pence % 100 ? 2 : 0)}` : null;

  /* The real guest list, refreshed after an RSVP so your own avatar appears. */
  useEffect(() => {
    let on = true;
    createApi(getToken).eventAttendees(event.id)
      .then(d => { if (on) setGoing(d); })
      .catch(() => {});
    return () => { on = false; };
  }, [event.id, rsvp]);

  /* One tap into the phone's calendar. Times come from starts_at; an hour is
     assumed when the event carries no end. */
  const addToCalendar = () => {
    const start = new Date(event.starts_at);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    const stamp = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const esc = (s) => String(s || "").replace(/([,;])/g, "\\$1").replace(/\n/g, "\\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//FFG Connect//EN", "BEGIN:VEVENT",
      `UID:${event.id}@connect.ffg`, `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(event.name)}`, `LOCATION:${esc(event.where)}`,
      `DESCRIPTION:${esc("Your seat is confirmed. Ticket in the FFG Connect app.")}`,
      "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.name.replace(/[^\w ]+/g, "").trim() || "event"}.ics`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  /* Free events confirm in place; paid events hand over to Stripe and the
     seat is granted by the webhook the moment payment lands. */
  const confirmFree = async () => {
    setConfirming(false);
    setRsvp(true); // optimistic — the sheet already promised
    try { await createApi(getToken).attendEvent(event.id); }
    catch { setRsvp(false); return; }
    setShowTicket(true);
  };
  const payForSeat = async () => {
    if (payBusy) return;
    setPayBusy(true);
    try {
      const { checkout_url } = await createApi(getToken).eventCheckout(event.id);
      window.location.href = checkout_url; // Stripe brings them back to the app
    } catch {
      setPayBusy(false);
    }
  };
  const shareEvent = () => {
    const link = `${window.location.origin}/?e=${encodeURIComponent(event.id)}`;
    const title = `${event.name} — ${event.date} ${event.month}`;
    if (navigator.share) navigator.share({ title, url: link }).catch(() => {});
    else navigator.clipboard?.writeText(link);
  };
  /* Portaled to <body>: rendered inside the frame this sheet sits UNDER the
     bottom nav (z40) and the RSVP bar is unreachable — the stacking trap. */
  return createPortal(
    <div style={{ position: "fixed", inset: 0, background: T.ink, zIndex: 60, display: "flex", flexDirection: "column" }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 12px", borderBottom: `1px solid ${T.line}`,
        background: `${T.ink}F0`, backdropFilter: "blur(12px)",
      }}>
        <ChevronLeft size={24} color={T.cream} style={{ cursor: "pointer" }} onClick={onBack} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15, color: T.cream }}>Event</span>
        <Share2 size={20} color={T.cream} style={{ cursor: "pointer" }} onClick={shareEvent} />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {/* hero */}
        {event.image && (
          <div style={{ margin: "18px 18px 0", borderRadius: 20, overflow: "hidden", border: `1px solid ${T.line}` }}>
            <img src={event.image_url || EVENT_PICS[event.image]} alt="" style={{ width: "100%", display: "block" }} />
          </div>
        )}
        <div style={{
          margin: 18, borderRadius: 20, padding: "26px 20px",
          background: `linear-gradient(145deg, ${T[PILLAR[event.tag].k]}26, ${T.ink2} 75%)`,
          border: `1px solid ${T[PILLAR[event.tag].k]}45`,
        }}>
          <PillarTag name={event.tag} />
          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 27, color: T.cream, lineHeight: 1.15, margin: "12px 0 14px" }}>{event.name}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[[Calendar, `${event.date} ${event.month} · ${event.time}`], [MapPin, event.where]].map(([Ico, txt], i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
                <Ico size={15} color={T.gold} />{txt}
              </div>
            ))}
          </div>
        </div>

        {/* host — only when the event names one */}
        {host && (
        <div onClick={() => openUser(host.id)} style={{
          margin: "0 18px 16px", display: "flex", alignItems: "center", gap: 12, cursor: "pointer",
          background: T.card, border: `1px solid ${T.line}`, borderRadius: 16, padding: "13px 15px",
        }}>
          <Avatar initials={host.id} size={42} ring={T.gold} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.08em" }}>HOSTED BY</div>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14, color: T.cream }}>{host.name}</span>
              {host.verified && <BadgeCheck size={14} color={T.gold} />}
            </div>
          </div>
          <ChevronRight size={17} color={T.dim} />
        </div>
        )}

        {/* about */}
        {event.about && (
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 8 }}>ABOUT</div>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{event.about}</p>
        </div>
        )}

        {/* agenda — only for events that carry one */}
        {event.agenda?.length > 0 && (
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>AGENDA</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {event.agenda.map(([time, item], i) => (
              <div key={i} style={{ display: "flex", gap: 14, padding: "10px 0", borderBottom: i < event.agenda.length - 1 ? `1px solid ${T.line}` : "none" }}>
                <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 13, color: T.gold, width: 46, flexShrink: 0 }}>{time}</span>
                <span style={{ fontSize: 13.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
        )}

        {/* who's going — the real guest list */}
        <div style={{ padding: "0 18px 18px" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.14em", color: T.gold, fontWeight: 600, fontFamily: "'Inter',sans-serif", marginBottom: 10 }}>
            WHO'S GOING{going?.count ? ` · ${going.count}` : ""}
          </div>
          {going?.attendees?.length > 0 ? (
            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", rowGap: 8 }}>
              {going.attendees.slice(0, 8).map((a, i) => (
                <div key={a.id} onClick={() => openUser(a.id)} style={{ marginLeft: i === 0 ? 0 : -10, cursor: "pointer" }}>
                  <Avatar initials={a.id} size={40} ring={T.ink} />
                </div>
              ))}
              <span style={{ marginLeft: 12, fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                {going.attendees.slice(0, 2).map(a => (a.name || "").split(" ")[0]).filter(Boolean).join(", ")}
                {going.count > 2 ? ` and ${going.count - 2} other${going.count - 2 === 1 ? "" : "s"} are going` : going.count > 0 ? (going.count === 1 ? " is going" : " are going") : ""}
              </span>
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              Be the first to reserve a seat.
            </span>
          )}
        </div>
        <div style={{ height: 110 }} />
      </div>

      {/* RSVP bar */}
      <div style={{ padding: "12px 18px calc(16px + env(safe-area-inset-bottom))", borderTop: `1px solid ${T.line}`, background: T.ink }}>
        <button
          onClick={() => rsvp ? setShowTicket(true) : priced ? payForSeat() : setConfirming(true)}
          style={{
            width: "100%", padding: "16px 0", borderRadius: 999, cursor: "pointer",
            border: rsvp ? `1px solid ${T.community}` : "none",
            background: rsvp ? "transparent" : `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
            fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 15,
            color: rsvp ? T.community : T.ink,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            opacity: payBusy ? 0.6 : 1,
          }}>
          {rsvp
            ? (<><Ticket size={17} />You're going — view ticket</>)
            : priced
              ? (payBusy ? "Taking you to payment…" : event.payment_pending ? `Complete payment — ${priceLabel}` : `Pay ${priceLabel} — reserve my seat`)
              : "RSVP — Reserve my seat"}
        </button>
        {rsvp && event.starts_at && (
          <button onClick={addToCalendar} style={{
            width: "100%", marginTop: 8, padding: "10px 0", borderRadius: 999, cursor: "pointer",
            border: "none", background: "transparent", color: T.dim,
            fontFamily: "'Inter',sans-serif", fontWeight: 600, fontSize: 13,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          }}>
            <Calendar size={14} />Add to my calendar
          </button>
        )}
      </div>

      {/* RSVP confirmation sheet */}
      {confirming && (
        <div style={{ position: "absolute", inset: 0, zIndex: 40, display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
          <div onClick={() => setConfirming(false)} style={{ position: "absolute", inset: 0, background: "#00000090", backdropFilter: "blur(3px)" }} />
          <div style={{
            position: "relative", background: T.ink2, borderRadius: "22px 22px 0 0",
            border: `1px solid ${T.line}`, borderBottom: "none",
            padding: "20px 20px calc(20px + env(safe-area-inset-bottom))",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 17, color: T.cream }}>Confirm your RSVP</span>
              <X size={22} color={T.dim} style={{ cursor: "pointer" }} onClick={() => setConfirming(false)} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 18 }}>
              {[
                [Calendar, "Date & time", `${event.date} ${event.month} 2026 · ${event.time}`],
                [MapPin, "Location", event.where],
                [Users, "Going", `${(event.going?.length || 0)} members confirmed`],
                [Ticket, "Your seat", "Member — free"],
              ].map(([Ico, label, val]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 11, flexShrink: 0,
                    background: T.card, border: `1px solid ${T.line}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                  }}><Ico size={16} color={T.gold} /></div>
                  <div>
                    <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", letterSpacing: "0.06em" }}>{label.toUpperCase()}</div>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: T.cream, fontFamily: "'Inter',sans-serif" }}>{val}</div>
                  </div>
                </div>
              ))}
            </div>
            <button onClick={confirmFree} style={{
              width: "100%", padding: "15px 0", borderRadius: 999, border: "none", cursor: "pointer",
              background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`,
              color: T.ink, fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 14.5,
            }}>Confirm — see you there</button>
          </div>
        </div>
      )}

      {/* ticket */}
      {showTicket && (
        <div style={{ position: "absolute", inset: 0, zIndex: 41, display: "flex", alignItems: "center", justifyContent: "center", padding: 26 }}>
          <div onClick={() => setShowTicket(false)} style={{ position: "absolute", inset: 0, background: "#000000C8", backdropFilter: "blur(5px)" }} />
          <div style={{
            position: "relative", width: "100%", maxWidth: 330, borderRadius: 24, overflow: "hidden",
            background: `linear-gradient(160deg, ${T.gold}, ${T.goldSoft})`, padding: "24px 22px",
            animation: "ffgStepIn 0.4s cubic-bezier(.2,.8,.2,1)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
              <img src={LOGO_DARK_MARK} alt="" style={{ width: 30, height: 30 }} />
              <span style={{ fontSize: 10, letterSpacing: "0.2em", fontWeight: 800, color: "#0A0A0DAA", fontFamily: "'Inter',sans-serif" }}>MEMBER TICKET</span>
            </div>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 900, fontSize: 22, lineHeight: 1.2, color: "#0A0A0D", marginBottom: 14 }}>{event.name}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 18 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#0A0A0D", fontFamily: "'Inter',sans-serif" }}>{event.date} {event.month} 2026 · {event.time}</span>
              <span style={{ fontSize: 12.5, color: "#0A0A0DB0", fontFamily: "'Inter',sans-serif" }}>{event.where}</span>
              <span style={{ fontSize: 12.5, color: "#0A0A0DB0", fontFamily: "'Inter',sans-serif" }}>{member?.name || "FFG Member"} · Admit one</span>
            </div>
            {/* stylised QR */}
            <div style={{ background: "#0A0A0D", borderRadius: 16, padding: 14, display: "flex", justifyContent: "center" }}>
              <svg width="110" height="110" viewBox="0 0 21 21">
                {Array.from({ length: 21 * 21 }).map((_, i) => {
                  const x = i % 21, y = Math.floor(i / 21);
                  const corner = (x < 5 && y < 5) || (x > 15 && y < 5) || (x < 5 && y > 15);
                  const edge = corner && (x === 0 || y === 0 || x === 4 || y === 4 || x === 16 || y === 20 || x === 20 || y === 16);
                  const centerDot = corner && x > 1 && x < 3.5 && y > 1 && y < 3.5;
                  const fill = corner ? (edge || centerDot) : ((x * 7 + y * 13 + x * y) % 5 < 2 && x > 5 && y > 5) || ((x * 3 + y * 11) % 7 < 2);
                  return fill ? <rect key={i} x={x} y={y} width="1" height="1" fill={T.goldSoft} /> : null;
                })}
              </svg>
            </div>
            <div style={{ textAlign: "center", marginTop: 12, fontSize: 10.5, color: "#0A0A0D90", fontFamily: "'Inter',sans-serif", letterSpacing: "0.08em" }}>SCAN AT THE DOOR · TAP ANYWHERE TO CLOSE</div>
          </div>
        </div>
      )}
    </div>,
    document.body
  );
};

/* ---------- rooms (clubhouse-style) ---------- */
/**
 * Reads live rooms from the API and refreshes while the tab is open, so the
 * counts on this screen are the same real numbers you see inside a room.
 */
const Rooms = ({ openRoom, openUser }) => {
  const { getToken } = useAuth();
  const [rooms, setRooms] = useState(null);

  useEffect(() => {
    let live = true;
    const load = () => createApi(getToken).listRooms()
      .then(rs => { if (live) setRooms(rs); })
      .catch(() => { if (live) setRooms([]); });
    load();
    const poll = setInterval(load, 15_000);
    return () => { live = false; clearInterval(poll); };
  }, [getToken]);

  // Shape the API rows like the old constants so the card markup is unchanged.
  const list = (rooms ?? []).map(r => ({
    id: r.id, live: r.is_live, title: r.title, desc: r.description,
    tag: r.tag, when: r.scheduled_for, listeners: r.listeners,
    speakers: r.speakers || [],
  }));

  return (
  <div>
    <SectionTitle eyebrow="LIVE AUDIO · DROP IN" title="Rooms" />
    {rooms === null && (
      <div style={{ padding: "0 18px 12px", fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
        Loading rooms…
      </div>
    )}
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {list.map(r => (
        <div key={r.id} onClick={() => r.live && openRoom(r)} style={{
          background: T.card, border: `1px solid ${r.live ? `${T.gold}45` : T.line}`,
          borderRadius: 18, padding: 16, cursor: r.live ? "pointer" : "default",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 9 }}>
            {r.live ? (
              <span style={{
                display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10.5, fontWeight: 700,
                letterSpacing: "0.1em", color: T.gold, fontFamily: "'Inter',sans-serif",
              }}>
                <span style={{ width: 7, height: 7, borderRadius: 4, background: T.gold, animation: "ffgPulse 1.6s infinite" }} />LIVE
              </span>
            ) : (
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
                <Clock size={12} />{r.when}
              </span>
            )}
            <PillarTag name={r.tag} />
          </div>

          <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 16.5, color: T.cream, lineHeight: 1.3, marginBottom: 5 }}>{r.title}</div>
          <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginBottom: 13 }}>{r.desc}</div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center" }}>
              {r.speakers.map((s, i) => (
                <div key={s.id} style={{ marginLeft: i === 0 ? 0 : -9 }} onClick={e => { e.stopPropagation(); openUser(s.id); }}>
                  <Avatar initials={s.id} size={34} ring={T.card} />
                </div>
              ))}
              <span style={{ marginLeft: r.speakers.length ? 10 : 0, fontSize: 12, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
                {r.speakers.length
                  ? `Hosted by ${r.speakers.map(s => s.name.split(" ")[0]).join(", ")}`
                  : "Open room"}
              </span>
            </div>
            {/* An honest count. Zero is a real answer, not something to hide. */}
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: r.listeners ? T.cream : T.dim, fontFamily: "'Inter',sans-serif", fontWeight: 600 }}>
              {r.live ? <Radio size={13} color={r.listeners ? T.gold : T.dim} /> : <Users size={13} />}
              {r.listeners === 0 ? "Empty" : r.listeners}
            </span>
          </div>

          {/* The card was clickable but never said so. */}
          <button
            onClick={e => { e.stopPropagation(); r.live && openRoom(r); }}
            disabled={!r.live}
            style={{
              width: "100%", marginTop: 14, padding: "12px 0", borderRadius: 999,
              cursor: r.live ? "pointer" : "default", border: r.live ? "none" : `1px solid ${T.line}`,
              background: r.live ? `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})` : "transparent",
              color: r.live ? T.ink : T.dim,
              fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5,
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            }}>
            {r.live ? <><Radio size={15} />Join room</> : <><Clock size={14} />Starts {r.when}</>}
          </button>
        </div>
      ))}
    </div>
    <style>{`@keyframes ffgPulse { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }`}</style>
    <div style={{ height: 90 }} />
  </div>
  );
};

/* RoomView now lives in RoomStage.jsx: the room is the app's main feature
   and had outgrown being one more component in this file. */


const Capital = () => (
  <div>
    <SectionTitle eyebrow="FFG DIGITAL · ADVISE, POWER, OWN" title="Powered founders" />
    <div style={{ margin: "0 18px 16px", borderRadius: 18, padding: 18, background: `linear-gradient(130deg, ${T.gold}22, ${T.ink2})`, border: `1px solid ${T.gold}40` }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <Zap size={16} color={T.gold} />
        <span style={{ fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13.5, color: T.gold }}>Cohort One — applications open</span>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: T.cream, fontFamily: "'Inter',sans-serif" }}>
        Consultancy, funding and hands-on technology support — with FFG taking a stake in your success.
      </p>
      <button style={{
        marginTop: 13, padding: "10px 18px", borderRadius: 999, border: "none", background: T.gold,
        fontFamily: "'Inter',sans-serif", fontWeight: 700, fontSize: 13, color: T.ink, cursor: "pointer",
      }}>Apply now</button>
    </div>
    <div style={{ padding: "0 18px", display: "flex", flexDirection: "column", gap: 12 }}>
      {FOUNDERS.map(f => (
        <div key={f.n} style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 16, display: "flex", alignItems: "center", gap: 13 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 15.5, color: T.cream }}>{f.n}</div>
            <div style={{ fontSize: 12.5, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{f.desc}</div>
          </div>
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "flex-end", color: T.gold }}>
              <TrendingUp size={13} /><span style={{ fontFamily: "'Archivo',sans-serif", fontWeight: 700, fontSize: 14.5 }}>{f.raised}</span>
            </div>
            <div style={{ fontSize: 11, color: T.dim, fontFamily: "'Inter',sans-serif", marginTop: 2 }}>{f.stage}</div>
          </div>
        </div>
      ))}
    </div>
    <div style={{ height: 90 }} />
  </div>
);

/* ---------- shell ---------- */
const TABS = [
  { id: "feed", label: "Home", icon: Home },
  { id: "rooms", label: "Rooms", icon: Radio },
  // Labelled "Meet" at the client's request. The id stays `connect` so the
  // Connect *pillar* on profiles, posts, events and rooms is unaffected.
  { id: "connect", label: "Meet", icon: Handshake },
  { id: "events", label: "Events", icon: Calendar },
  { id: "reads", label: "Library", icon: BookOpen },
  // Capital is hidden for now at the client's request — to be revisited later.
  // The <Capital /> screen below is kept intact; restore this entry to bring it
  // back. Note this is only the nav tab: "Capital" as a *pillar* on member
  // profiles, posts, events and rooms stays untouched.
  // { id: "capital", label: "Capital", icon: Banknote },
  { id: "profile", label: "You", icon: User },
];

export default function FFGApp() {
  const vp = useViewport();
  const { isSignedIn, isLoaded: authLoaded, getToken } = useAuth();
  const { signOut } = useClerk();

  /**
   * The member row behind the signed-in Clerk account. Distinct from `member`
   * below, which is the local onboarding answers — this one is the server's
   * truth and carries the id, the avatar and whether you may publish.
   * Null while loading, and null for a Clerk user with no membership.
   */
  const [profile, setProfile] = useState(null);
  useEffect(() => {
    if (!isSignedIn) { setProfile(null); return; }
    let live = true;
    createApi(getToken).me()
      .then(p => { if (live) setProfile(p); })
      .catch(e => console.error('[profile] could not load', e.message));
    return () => { live = false; };
  }, [isSignedIn, getToken]);

  /**
   * Presence heartbeat: one ping a minute while the app is open and the tab
   * visible. This is where "time in app" on the admin dashboard comes from.
   */
  useEffect(() => {
    if (!isSignedIn || !profile) return;
    const api = createApi(getToken);
    const ping = () => {
      if (document.visibilityState === "visible") api.ping().catch(() => {});
    };
    ping();
    const t = setInterval(ping, 60_000);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", ping); };
  }, [isSignedIn, profile, getToken]);

  /**
   * The member directory. USERS is module-level so every screen's existing
   * USERS[id] lookups keep working; this bump makes them re-render once the
   * real people arrive. Members only — the API 401s anyone else, so this
   * waits for a resolved profile.
   */
  const [, setDirectoryVersion] = useState(0);
  useEffect(() => {
    if (!isSignedIn || !profile) return;
    let live = true;
    const api = createApi(getToken);
    // Directory + all four content shelves in one sweep. Each list fails
    // soft: an empty shelf is an empty shelf, not a broken app.
    Promise.all([
      api.listMembers().catch(() => ({ members: [] })),
      api.listArticles().catch(() => []),
      api.listEvents().catch(() => ({ events: [] })),
      api.listReplays().catch(() => ({ replays: [] })),
      api.listWorkshops().catch(() => ({ workshops: [] })),
    ]).then(([m, articles, ev, rp, ws]) => {
      if (!live) return;
      hydrateUsers(m.members);
      hydrateContent({ articles, events: ev.events, replays: rp.replays, workshops: ws.workshops });
      setDirectoryVersion(v => v + 1);
    });
    return () => { live = false; };
  }, [isSignedIn, profile, getToken]);

  // Restored from localStorage: the Google redirect reloads the page, which
  // would otherwise drop a member back onto the splash screen after sign-in.
  const [entered, setEntered] = useState(() => readFlag("ffg.entered") === "1");
  const [member, setMember] = useState(() => readJSON("ffg.member"));
  const [tab, setTab] = useState("feed");
  T = LIGHT;

  useEffect(() => { if (entered) writeFlag("ffg.entered", "1"); }, [entered]);
  useEffect(() => { if (member) writeJSON("ffg.member", member); }, [member]);
  const [viewUser, setViewUser] = useState(null);
  const [viewRoom, setViewRoom] = useState(null);
  const [viewEvent, setViewEvent] = useState(null);
  const [viewArticle, setViewArticle] = useState(null);
  const [viewReplay, setViewReplay] = useState(null);
  // Bumped when the replay viewer closes so the Watch shelf re-reads progress.
  const [watchVersion, setWatchVersion] = useState(0);
  // A one-shot "open the Library on this shelf" request, e.g. from search.
  const [shelfRequest, setShelfRequest] = useState(null);
  const [showMessages, setShowMessages] = useState(false);
  const [chatWith, setChatWith] = useState(null);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [concierge, setConcierge] = useState(false);
  // Bumped by the floating button on the You tab; UserProfile opens its composer.
  const [composeSignal, setComposeSignal] = useState(0);

  /**
   * Real-time doorbell. One WebSocket while the app is open; every event
   * fans out as a window event ("ffg:rt") that any screen can listen to.
   * Reconnects with a fresh token; the polls below remain as the net.
   */
  useEffect(() => {
    if (!isSignedIn || !profile) return;
    let ws = null;
    let alive = true;
    let retry = 1000;
    const base = (import.meta.env.VITE_API_BASE || window.location.origin).replace(/^http/, "ws").replace(/\/$/, "");
    const connect = async () => {
      if (!alive) return;
      try {
        const token = await getToken();
        ws = new WebSocket(`${base}/ws?token=${encodeURIComponent(token)}`);
        ws.onopen = () => { retry = 1000; };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            window.dispatchEvent(new CustomEvent("ffg:rt", { detail: msg }));
          } catch { /* not ours */ }
        };
        ws.onclose = () => { if (alive) setTimeout(connect, retry = Math.min(retry * 2, 30_000)); };
      } catch { if (alive) setTimeout(connect, retry = Math.min(retry * 2, 30_000)); }
    };
    connect();
    return () => { alive = false; try { ws?.close(); } catch { /* gone */ } };
  }, [isSignedIn, profile, getToken]);

  /**
   * Unread DMs: instant via the socket, polled as the fallback. Feeds the
   * inbox badge and the dot on the You tab.
   */
  const [unreadDMs, setUnreadDMs] = useState(0);
  useEffect(() => {
    if (!isSignedIn || !profile) return;
    let live = true;
    const check = () => createApi(getToken).listThreads()
      .then(({ threads }) => { if (live) setUnreadDMs(threads.reduce((s, t) => s + (t.unread || 0), 0)); })
      .catch(() => {});
    check();
    const t = setInterval(check, 30_000);
    const onRt = (e) => { if (e.detail?.type === "dm") check(); };
    window.addEventListener("ffg:rt", onRt);
    return () => { live = false; clearInterval(t); window.removeEventListener("ffg:rt", onRt); };
  }, [isSignedIn, profile, getToken]);
  const openUser = uid => setViewUser(uid);

  /* ?u=<handle> deep links (profile links, QR codes) resolve here once the
     directory has arrived. One shot, then the URL is cleaned. */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const wantedUser = params.get("u");
    const wantedArticle = params.get("a");
    const wantedEvent = params.get("e");
    if (wantedUser && Object.keys(USERS).length) {
      const match = Object.values(USERS).find(u => u.handle === wantedUser || u.id === wantedUser);
      if (match) setViewUser(match.id);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (wantedArticle && ARTICLES.length) {
      const art = ARTICLES.find(x => x.id === wantedArticle);
      if (art) setViewArticle(art);
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (wantedEvent && EVENTS.length) {
      if (EVENTS.some(x => x.id === wantedEvent)) setViewEvent(wantedEvent);
      window.history.replaceState({}, "", window.location.pathname);
    }
  });

  // The rail is app chrome, so it only appears once the member is actually
  // inside — never behind the splash, onboarding or sign-in overlays.
  const inApp = entered && !!member && !!isSignedIn;
  const showRail = vp.isDesktop && inApp;
  const resetViews = () => {
    setViewUser(null); setViewRoom(null); setViewEvent(null); setViewArticle(null); setViewReplay(null);
    setShowMessages(false); setChatWith(null); setShowNotifs(false); setShowSearch(false);
  };

  return (
    <div style={{
      height: "100dvh", overflow: "hidden",
      background: "#E9E4D9",
      display: "flex", justifyContent: "center", fontFamily: "'Inter',sans-serif",
    }}>
      <style>{`
        .ffg-frame ::-webkit-scrollbar { width: 0; height: 0; }
        .ffg-scroll { -webkit-overflow-scrolling: touch; }
      `}</style>

      {showRail && (
        <DesktopRail
          tabs={TABS}
          tab={tab}
          T={T}
          width={vp.railWidth}
          signedIn={!!isSignedIn}
          onSignOut={() => signOut()}
          onTab={id => { setTab(id); resetViews(); }}
        />
      )}

      <div className="ffg-frame" style={{
        width: "100%", maxWidth: vp.frameWidth ?? "100%", height: "100dvh", background: T.ink,
        /* A flex item defaults to min-width:auto, so it refuses to shrink
           below its widest unbreakable child and quietly grows past the
           viewport, taking the layout with it. */
        minWidth: 0,
        position: "relative", overflow: "hidden", display: "flex", flexDirection: "column",
        borderLeft: vp.isPhone ? "none" : `1px solid ${T.line}`,
        borderRight: vp.isPhone ? "none" : `1px solid ${T.line}`,
      }}>
        {/* ambient zodiac field behind the whole app */}
        <div style={{ position: "absolute", inset: 0, zIndex: 0, pointerEvents: "none" }}>
          <ZodiacField density={22} opacity={0.09} color="168, 137, 78" />
        </div>

        {!entered && <Cover T={T} onEnter={() => setEntered(true)} />}
        {entered && !member && <Onboarding onComplete={prof => setMember(prof)} />}
        {/* Sign-in sits after onboarding: splash → onboarding → Google → app. */}
        {entered && member && authLoaded && !isSignedIn && <SignInGate T={T} member={member} />}

        {tab !== "profile" && <Header onBell={() => setShowNotifs(true)} onSearch={() => setShowSearch(true)} />}
        <div className="ffg-scroll" style={{ flex: 1, overflowY: "auto", overscrollBehavior: "contain" }}>
          {tab === "feed" && <Feed openUser={openUser} openConcierge={() => setConcierge(true)} openRoom={id => setViewRoom(id)} member={member} />}
          {tab === "rooms" && <Rooms openRoom={id => setViewRoom(id)} openUser={openUser} />}
          {tab === "connect" && <Connect openUser={openUser} />}
          {tab === "events" && <Events openEvent={id => setViewEvent(id)} />}
          {tab === "reads" && (
            <Articles
              openArticle={a => setViewArticle(a)}
              openReplay={r => setViewReplay(r)}
              openUser={openUser}
              member={member}
              watchVersion={watchVersion}
              shelfRequest={shelfRequest}
            />
          )}
          {/* Capital screen hidden — see TABS above. */}
          {tab === "profile" && profile && (
            <div style={{ position: "relative", height: "100%" }}>
              {/* Your own card: me:true is what arms the edit controls, and
                  the server profile supplies every field that matters. The
                  directory entry contributes only decorations if present. */}
              <UserProfile
                user={{ highlights: [], tiles: [], ...(USERS[profile.id] || {}), id: profile.id, me: true }}
                onBack={null} member={member} openUser={openUser}
                profile={profile} onProfileSaved={setProfile}
                composeSignal={composeSignal}
                unreadDMs={unreadDMs}
                openConcierge={() => setConcierge(true)}
                openMessages={() => setShowMessages(true)} openNotifs={() => setShowNotifs(true)} />
            </div>
          )}
          {tab === "profile" && !profile && (
            <div style={{ padding: "40px 24px", textAlign: "center", fontSize: 13, color: T.dim, fontFamily: "'Inter',sans-serif" }}>
              Loading your profile…
            </div>
          )}
        </div>

        {/* messaging + notifications overlays */}
        {showMessages && <MessagesScreen onBack={() => setShowMessages(false)} openChat={uid => setChatWith(uid)} openUser={openUser} />}
        {chatWith && <ChatView uid={chatWith} onBack={() => setChatWith(null)} openUser={openUser} />}
        {showNotifs && <NotificationsScreen onBack={() => setShowNotifs(false)} openUser={openUser} />}

        {/* search — closes as it hands off, so results open on a clean stack */}
        {showSearch && (
          <SearchScreen
            onBack={() => setShowSearch(false)}
            openUser={uid => { setShowSearch(false); setViewUser(uid); }}
            openRoom={id => { setShowSearch(false); setViewRoom(id); }}
            openEvent={id => { setShowSearch(false); setViewEvent(id); }}
            openArticle={a => { setShowSearch(false); setViewArticle(a); }}
            openReplay={r => { setShowSearch(false); setViewReplay(r); }}
            openLearn={() => { setShowSearch(false); setTab("reads"); setShelfRequest({ shelf: "learn", n: Date.now() }); }}
          />
        )}

        {/* article reader + replay viewer overlays */}
        {viewArticle && <ArticleReader article={viewArticle} onBack={() => setViewArticle(null)} openUser={openUser} />}
        {viewReplay && (
          <ReplayViewer
            replay={viewReplay}
            openUser={openUser}
            onBack={() => { setViewReplay(null); setWatchVersion(v => v + 1); }}
          />
        )}

        {/* live room + event detail overlays */}
        {viewEvent && <EventDetail event={EVENTS.find(e => e.id === viewEvent)} onBack={() => setViewEvent(null)} openUser={openUser} member={member} />}
        {/* viewRoom holds the API-shaped room object (the Rooms tab passes
            it whole); a bare id from an older caller still resolves. */}
        {viewRoom && profile && (
          <React.Suspense fallback={null}>
            <RoomStage T={T} room={typeof viewRoom === "object" ? viewRoom : { id: viewRoom, title: "" }} profile={profile}
              onLeave={() => setViewRoom(null)}
              openUser={uid => { setViewRoom(null); openUser(uid); }} />
          </React.Suspense>
        )}

        {/* visiting another member's profile */}
        {viewUser && USERS[viewUser] && <UserProfile user={USERS[viewUser]} onBack={() => setViewUser(null)} member={member} openUser={openUser} openChat={uid => { setViewUser(null); setChatWith(uid); }} />}

        {/* AI concierge — floating direct line to the group */}
        {/* The floating button earns its keep per tab: everywhere it is the
            Concierge, but on your own page it is the New post CTA — the
            Concierge moves into that page's ⋯ menu. Signed-in members only:
            it has no business floating over the sign-in gate. */}
        {!concierge && entered && member && isSignedIn && profile && (
          <button
            onClick={() => tab === "profile" ? setComposeSignal(s => s + 1) : setConcierge(true)}
            aria-label={tab === "profile" ? "New post" : "Ask the Concierge"}
            style={{
              position: "absolute",
              bottom: showRail ? 26 : "calc(96px + env(safe-area-inset-bottom))",
              right: 18, zIndex: 42,
              width: 56, height: 56, borderRadius: "50%", border: `1px solid ${T.goldSoft}`, cursor: "pointer",
              background: `linear-gradient(135deg, ${T.gold}, ${T.goldSoft})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 6px 24px ${T.gold}50`,
            }}>
            {tab === "profile"
              ? <ImagePlus size={24} color={T.ink} strokeWidth={2.2} />
              : <AgentMark size={26} color={T.ink} strokeWidth={2.2} />}
          </button>
        )}
        {concierge && <Concierge onClose={() => setConcierge(false)} />}

        {/* bottom nav — touch layouts only; desktop gets the left rail instead */}
        {!showRail && (
        <div style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          display: "flex", justifyContent: "space-around",
          padding: "10px 4px calc(14px + env(safe-area-inset-bottom))",
          background: `${T.ink}F5`, backdropFilter: "blur(14px)", borderTop: `1px solid ${T.line}`, zIndex: 40,
        }}>
          {TABS.map(t => {
            const Ico = t.icon; const on = tab === t.id;
            return (
              <button key={t.id} onClick={() => { setTab(t.id); resetViews(); }} style={{
                background: "none", border: "none", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center", gap: 4, padding: "2px 6px",
                color: on ? T.gold : T.dim, transition: "color 0.2s", position: "relative",
              }}>
                {t.id === "profile" && unreadDMs > 0 && (
                  <span style={{
                    position: "absolute", top: 0, right: 2, width: 8, height: 8,
                    borderRadius: "50%", background: T.gold,
                  }} />
                )}
                <Ico size={22} strokeWidth={on ? 2.4 : 2} />
                <span style={{ fontSize: 10.5, fontFamily: "'Inter',sans-serif", fontWeight: on ? 700 : 500 }}>{t.label}</span>
              </button>
            );
          })}
        </div>
        )}
      </div>
    </div>
  );
}
