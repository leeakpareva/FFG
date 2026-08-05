/**
 * Cover — the first screen a member sees.
 *
 * Replaces the old dark Splash. Light, editorial, and left-aligned, matching
 * the rest of the light-only app.
 *
 * The headline is data, not markup: edit HERO_LINES and the reveal retimes
 * itself. Words fade up one at a time out of a blur, deliberately slowly, so
 * the sentence assembles in front of you rather than snapping in. Everything
 * after it waits its turn.
 *
 * Respects prefers-reduced-motion: if a member has asked their device to stop
 * moving things, the whole thing is simply present, immediately.
 */
import React, { useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";

/* The headline. `tone: "gold"` picks out a word; everything else is ink.
   Each inner array is one line, so line breaks stay a design decision
   rather than an accident of container width. */
const HERO_LINES = [
  [{ t: "Where", tone: "ink" }],
  [{ t: "ambitious", tone: "ink" }],
  [{ t: "connections", tone: "gold" }],
  [{ t: "create impact.", tone: "ink" }],
];

const SUBCOPY = "The professional network designed for visionaries to connect, collaborate and grow.";

const CTA = "JOIN THE NETWORK";

/* Reveal timing. Slow on purpose. */
const WORD_STAGGER_MS = 300;
const WORD_EASE_MS = 1200;
const LOGO_AT = 250;

const WORDS = HERO_LINES.flat();

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const Cover = ({ onEnter, T }) => {
  const still = prefersReducedMotion();

  // How many headline words have landed. Starts complete if motion is off.
  const [shown, setShown] = useState(still ? WORDS.length : 0);
  const [logoIn, setLogoIn] = useState(still);

  useEffect(() => {
    if (still) return;
    const t = setTimeout(() => setLogoIn(true), LOGO_AT);
    return () => clearTimeout(t);
  }, [still]);

  useEffect(() => {
    if (still || shown >= WORDS.length) return;
    // First word waits for the logo; the rest follow at a steady beat.
    const delay = shown === 0 ? LOGO_AT + 650 : WORD_STAGGER_MS;
    const t = setTimeout(() => setShown((n) => n + 1), delay);
    return () => clearTimeout(t);
  }, [shown, still]);

  const done = shown >= WORDS.length;
  // Sub-copy and the button follow the sentence, not the clock, so retiming
  // the reveal or editing HERO_LINES keeps the sequence intact.
  const tailIn = still || done;

  const ease = "cubic-bezier(.16,.84,.28,1)";

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        zIndex: 50,
        background: T.ink,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(28px, 7vw, 44px) clamp(24px, 7vw, 36px) clamp(24px, 5vh, 34px)",
        boxSizing: "border-box",
      }}
    >
      {/* --- the fold on the right. Pure CSS: no asset to ship, and it
          rescales cleanly on any screen. Sits behind the text.
          A clipped wedge, not a blob: the straight diagonal is the whole
          character of it, so it is cut rather than blurred into place. --- */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "82%",
          opacity: logoIn ? 1 : 0,
          transform: logoIn ? "none" : "translateX(24px)",
          transition: `opacity 2.6s ease, transform 3s ${ease}`,
          pointerEvents: "none",
          clipPath: "polygon(62% 0, 100% 0, 100% 86%, 6% 100%)",
          background:
            "linear-gradient(158deg, #FBF8F3 0%, #F4EBDC 26%, #EADCC0 48%, #D9C093 68%, #C9A870 84%, #BE9A5E 100%)",
        }}
      >
        {/* specular streak along the fold */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(158deg, transparent 34%, rgba(255,255,255,.95) 46%, rgba(255,255,255,.25) 53%, transparent 60%)",
          }}
        />
        {/* warm bounce gathering at the bottom */}
        <div
          style={{
            position: "absolute",
            right: "-10%",
            bottom: "-14%",
            width: "86%",
            height: "48%",
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(206,158,84,.5) 0%, rgba(206,158,84,0) 70%)",
            filter: "blur(24px)",
          }}
        />
      </div>

      {/* --- logo mark --- */}
      <img
        src={T.logo}
        alt="Forbes Family Group"
        style={{
          position: "relative",
          zIndex: 2,
          width: 52,
          height: 52,
          objectFit: "contain",
          opacity: logoIn ? 1 : 0,
          transform: logoIn ? "none" : "translateY(10px)",
          transition: `opacity 1.4s ease, transform 1.4s ${ease}`,
          marginBottom: "clamp(26px, 6vh, 48px)",
        }}
      />

      {/* --- headline --- */}
      <h1
        style={{
          position: "relative",
          zIndex: 2,
          margin: 0,
          fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
          fontWeight: 700,
          fontSize: "clamp(34px, 10.5vw, 46px)",
          lineHeight: 1.08,
          letterSpacing: "-0.028em",
          maxWidth: "72%",
        }}
      >
        {(() => {
          let i = 0;
          return HERO_LINES.map((line, li) => (
            <span key={li} style={{ display: "block" }}>
              {line.map((w, wi) => {
                const idx = i++;
                const on = idx < shown;
                return (
                  <span
                    key={wi}
                    style={{
                      display: "inline-block",
                      color: w.tone === "gold" ? T.gold : T.cream,
                      opacity: on ? 1 : 0,
                      filter: on ? "blur(0)" : "blur(10px)",
                      transform: on ? "none" : "translateY(16px)",
                      transition: `opacity ${WORD_EASE_MS}ms ease, filter ${WORD_EASE_MS}ms ease, transform ${WORD_EASE_MS}ms ${ease}`,
                      whiteSpace: "pre",
                    }}
                  >
                    {w.t}
                  </span>
                );
              })}
            </span>
          ));
        })()}
      </h1>

      {/* --- sub-copy --- */}
      <p
        style={{
          position: "relative",
          zIndex: 2,
          margin: "clamp(20px, 4vh, 30px) 0 0",
          maxWidth: "58%",
          color: T.dim,
          fontFamily: "'Inter', sans-serif",
          fontSize: "clamp(13px, 3.7vw, 15px)",
          lineHeight: 1.7,
          opacity: tailIn ? 1 : 0,
          transform: tailIn ? "none" : "translateY(12px)",
          transition: `opacity 1.5s ease .25s, transform 1.5s ${ease} .25s`,
        }}
      >
        {SUBCOPY}
      </p>

      <div style={{ flex: 1, minHeight: 16 }} />

      {/* --- call to action --- */}
      <button
        onClick={onEnter}
        aria-label={CTA}
        style={{
          position: "relative",
          zIndex: 2,
          width: "100%",
          boxSizing: "border-box",
          border: "none",
          cursor: "pointer",
          background: T.cream,
          color: "#FFFFFF",
          borderRadius: 999,
          padding: "9px 9px 9px 28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          fontFamily: "'Inter', sans-serif",
          fontWeight: 500,
          fontSize: "clamp(11px, 3.1vw, 13px)",
          letterSpacing: "0.24em",
          boxShadow: "0 18px 40px -18px rgba(0,0,0,.55)",
          opacity: tailIn ? 1 : 0,
          transform: tailIn ? "none" : "translateY(16px)",
          transition: `opacity 1.4s ease .6s, transform 1.4s ${ease} .6s`,
        }}
      >
        {/* Shrinkable, so the label gives way before the pill can outgrow
            its container on a narrow screen. */}
        <span style={{ flex: 1, minWidth: 0, textAlign: "left", whiteSpace: "nowrap", overflow: "hidden" }}>
          {CTA}
        </span>
        <span
          style={{
            width: 44,
            height: 44,
            borderRadius: "50%",
            border: `1px solid ${T.gold}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <ArrowRight size={17} strokeWidth={1.8} color={T.gold} />
        </span>
      </button>

      {/* --- position indicator. Decorative: this is a single screen, and the
          dots echo the design without pretending to be a control. --- */}
      <div
        aria-hidden="true"
        style={{
          position: "relative",
          zIndex: 2,
          display: "flex",
          justifyContent: "center",
          gap: 9,
          marginTop: "clamp(16px, 3vh, 24px)",
          opacity: tailIn ? 1 : 0,
          transition: "opacity 1.4s ease .9s",
        }}
      >
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: d === 0 ? T.cream : "#CFCBC2",
            }}
          />
        ))}
      </div>
    </div>
  );
};

export default Cover;
