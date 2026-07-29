import React from 'react';

/**
 * Desktop navigation rail.
 *
 * On a large screen a bottom tab bar looks like a phone app that got resized,
 * so above 1024px the nav moves to a left rail and sits alongside the frame as
 * one centred composition.
 */
export default function DesktopRail({ tabs, tab, onTab, T, width, onSignOut, signedIn }) {
  return (
    <div style={{
      width, flexShrink: 0, background: T.ink2, borderRight: `1px solid ${T.line}`,
      display: 'flex', flexDirection: 'column', padding: '26px 16px 20px',
      height: '100dvh', boxSizing: 'border-box',
    }}>
      <div style={{
        fontSize: 10, letterSpacing: 3.2, fontWeight: 800, color: T.gold,
        textTransform: 'uppercase', padding: '0 10px', marginBottom: 28,
        lineHeight: 1.5,
      }}>
        Forbes<br />Family Group
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {tabs.map(t => {
          const Ico = t.icon;
          const on = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onTab(t.id)}
              aria-current={on ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 13,
                padding: '11px 12px', borderRadius: 11, cursor: 'pointer',
                background: on ? T.card : 'transparent',
                border: `1px solid ${on ? T.line : 'transparent'}`,
                color: on ? T.gold : T.dim,
                fontFamily: "'Inter',sans-serif", fontSize: 14,
                fontWeight: on ? 700 : 500, textAlign: 'left',
                transition: 'background 0.15s, color 0.15s',
              }}
            >
              <Ico size={19} strokeWidth={on ? 2.4 : 2} />
              {t.label}
            </button>
          );
        })}
      </nav>

      <div style={{ flex: 1 }} />

      {signedIn && (
        <button
          onClick={onSignOut}
          style={{
            padding: '10px 12px', borderRadius: 11, cursor: 'pointer',
            background: 'transparent', border: `1px solid ${T.line}`,
            color: T.dim, fontFamily: "'Inter',sans-serif", fontSize: 12.5,
            fontWeight: 600, textAlign: 'left',
          }}
        >
          Sign out
        </button>
      )}

      <div style={{ marginTop: 14, fontSize: 10, color: T.dim, padding: '0 4px', lineHeight: 1.6 }}>
        FFG · members only
      </div>
    </div>
  );
}
