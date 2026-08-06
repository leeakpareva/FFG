/**
 * The admin panel's design language — the same one the member app speaks.
 *
 * Tokens are duplicated from FFGApp.jsx on purpose: importing them would
 * couple the member bundle to the admin bundle, and a back-office restyle
 * must never be able to touch what members see. If the app rebrands, this
 * file is updated by hand, once.
 */
import React from 'react';

export const T = {
  ink: '#F7F4EE',      // page
  ink2: '#FFFFFF',
  card: '#FFFFFF',
  line: '#E5E1D6',
  cream: '#17171B',    // primary text
  dim: '#8A867C',
  gold: '#A8894E',
  goldSoft: '#8A6F3C',
  connect: '#5E7A94',
  community: '#4F7A62',
};

/* Chart palette — richer than the UI tones so categories separate. Validated
   (CVD + contrast) in this order; assign by slot, never cycle. The gold↔green
   adjacency sits in the 6–8 CVD band, which is legal because every chart that
   uses both carries a legend, segment gaps and tooltips. */
export const CHART = {
  cat: ['#C08519', '#2F8A50', '#3468B8', '#93295D'],
  single: '#C08519',
  neutral: '#B9B3A6',
  grid: '#ECE8DD',
};

/* Same fonts as the app. */
const font = document.createElement('link');
font.rel = 'stylesheet';
font.href = 'https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;900&family=Inter:wght@400;500;600;700&family=Playfair+Display:ital,wght@0,400;0,500;1,500&display=swap';
document.head.appendChild(font);

/* Phone discipline: the page never scrolls sideways, iOS never inflates the
   type, and the scroll doesn't rubber-band the whole shell around. */
const baseStyle = document.createElement('style');
baseStyle.textContent = `
  html, body { overflow-x: hidden; -webkit-text-size-adjust: 100%; overscroll-behavior-y: none; }
  * { box-sizing: border-box; }
`;
document.head.appendChild(baseStyle);

/** One line, ellipsised — for emails and other strings phones can't fit. */
export const clip = {
  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
};

export const fontHead = "'Archivo', sans-serif";
export const fontBody = "'Inter', sans-serif";

/** The two interlocking circles — the Connect mark. */
export const AgentMark = ({ size = 16, color = T.gold, strokeWidth = 1.9, style }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={style} aria-hidden="true">
    <circle cx="9" cy="12" r="6" stroke={color} strokeWidth={strokeWidth} />
    <circle cx="15" cy="12" r="6" stroke={color} strokeWidth={strokeWidth} />
  </svg>
);

export const Avatar = ({ initials, src, size = 40, ring }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    background: `linear-gradient(135deg, ${T.card}, ${T.ink})`,
    border: `2px solid ${ring || T.line}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: fontHead, fontWeight: 700, fontSize: size * 0.34, color: T.cream,
  }}>
    {src
      ? <img src={src} alt={initials} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      : initials}
  </div>
);

const PILLAR_COLORS = { Capital: T.gold, Community: T.community, Connect: T.connect };

export const PillarTag = ({ name }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: PILLAR_COLORS[name] || T.dim, background: `${PILLAR_COLORS[name] || T.dim}18`,
    padding: '3px 8px', borderRadius: 999, fontFamily: fontBody, whiteSpace: 'nowrap',
  }}>{name}</span>
);

export const SectionTitle = ({ eyebrow, title, right }) => (
  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', margin: '26px 0 16px' }}>
    <div>
      {eyebrow && <div style={{ fontSize: 11, letterSpacing: '0.18em', color: T.gold, fontWeight: 600, fontFamily: fontBody, marginBottom: 6 }}>{eyebrow}</div>}
      <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 24, color: T.cream, letterSpacing: '-0.01em' }}>{title}</div>
    </div>
    {right}
  </div>
);

export const Card = ({ children, style }) => (
  <div style={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 18, padding: 18, ...style }}>
    {children}
  </div>
);

export const StatTile = ({ value, label, accent }) => (
  <Card style={{ padding: '16px 18px', flex: 1, minWidth: 130 }}>
    <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 26, color: accent || T.cream, lineHeight: 1.1 }}>{value}</div>
    <div style={{ fontSize: 11.5, color: T.dim, fontFamily: fontBody, marginTop: 5, letterSpacing: '0.04em' }}>{label}</div>
  </Card>
);

export const Button = ({ children, onClick, kind = 'primary', disabled, style, type }) => (
  <button type={type} onClick={onClick} disabled={disabled} style={{
    padding: '11px 20px', borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
    fontFamily: fontBody, fontWeight: 700, fontSize: 13.5, border: 'none',
    opacity: disabled ? 0.5 : 1,
    ...(kind === 'primary'
      ? { background: `linear-gradient(120deg, ${T.gold}, ${T.goldSoft})`, color: '#FFF' }
      : kind === 'danger'
        ? { background: '#B3261E', color: '#FFF' }
        : { background: 'transparent', color: T.cream, border: `1px solid ${T.line}` }),
    ...style,
  }}>{children}</button>
);

export const Input = (props) => (
  <input {...props} style={{
    width: '100%', padding: '12px 14px', borderRadius: 12, outline: 'none',
    background: T.card, border: `1px solid ${T.line}`, color: T.cream,
    fontSize: 14, fontFamily: fontBody, boxSizing: 'border-box', ...props.style,
  }} />
);

export const TextArea = (props) => (
  <textarea {...props} style={{
    width: '100%', padding: '12px 14px', borderRadius: 12, outline: 'none', resize: 'vertical',
    background: T.card, border: `1px solid ${T.line}`, color: T.cream,
    fontSize: 14, fontFamily: fontBody, boxSizing: 'border-box', minHeight: 90, ...props.style,
  }} />
);

export const Select = ({ children, ...props }) => (
  <select {...props} style={{
    width: '100%', padding: '12px 14px', borderRadius: 12, outline: 'none',
    background: T.card, border: `1px solid ${T.line}`, color: T.cream,
    fontSize: 14, fontFamily: fontBody, boxSizing: 'border-box', ...props.style,
  }}>{children}</select>
);

export const Field = ({ label, children }) => (
  <label style={{ display: 'block', marginBottom: 14 }}>
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: T.dim, textTransform: 'uppercase', fontFamily: fontBody, marginBottom: 7 }}>{label}</div>
    {children}
  </label>
);

/** Bottom sheet on phones, centred dialog on desktop. */
export const Sheet = ({ title, onClose, children, wide }) => (
  <div style={{ position: 'fixed', inset: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
    <div onClick={onClose} style={{ position: 'absolute', inset: 0, background: '#00000066', backdropFilter: 'blur(2px)' }} />
    <div style={{
      position: 'relative', background: T.ink2, borderRadius: 20, border: `1px solid ${T.line}`,
      width: 'min(92vw, ' + (wide ? '760px' : '480px') + ')', maxHeight: '86vh', overflowY: 'auto', padding: 22,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 18, color: T.cream }}>{title}</div>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, color: T.dim, lineHeight: 1 }}>×</button>
      </div>
      {children}
    </div>
  </div>
);

export const StatusChip = ({ status }) => {
  const c = {
    paid: T.community, pending: T.gold, failed: '#B3261E', refunded: T.connect, void: T.dim,
    approved: T.community, rejected: '#B3261E', awaiting_details: T.connect,
  }[status] || T.dim;
  const label = status === 'awaiting_details' ? 'part one done' : status;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
      color: c, background: `${c}16`, padding: '3px 9px', borderRadius: 999, fontFamily: fontBody,
    }}>{label}</span>
  );
};

export const EmptyState = ({ title, hint }) => (
  <div style={{ padding: '34px 18px', textAlign: 'center' }}>
    <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 16, color: T.cream, marginBottom: 7 }}>{title}</div>
    {hint && <div style={{ fontSize: 13, lineHeight: 1.6, color: T.dim, fontFamily: fontBody }}>{hint}</div>}
  </div>
);

export const gbp = (pence) => '£' + (pence / 100).toLocaleString('en-GB', { minimumFractionDigits: 2 });
export const bytes = (n) => n > 1e9 ? (n / 1e9).toFixed(1) + ' GB' : n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.round(n / 1e3) + ' KB';
