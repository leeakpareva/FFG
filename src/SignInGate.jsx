import React, { useState } from 'react';
import { useSignIn } from '@clerk/clerk-react';
import { SSO_CALLBACK_PATH } from './clerkConfig.js';

/**
 * Google sign-in, sitting between Onboarding and the app.
 *
 * Rendered as an absolute overlay inside the phone frame — the same pattern
 * Splash (z50) and Onboarding (z49) use, so it stacks correctly at z48.
 *
 * Uses a full-page redirect rather than a popup: popups opened after an await
 * lose the user-gesture chain and get blocked by browsers.
 */
export default function SignInGate({ T, member }) {
  const { signIn, isLoaded } = useSignIn();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const go = async () => {
    if (busy || !isLoaded) return;
    setError(null);
    setBusy(true);
    try {
      const origin = window.location.origin;
      await signIn.authenticateWithRedirect({
        strategy: 'oauth_google',
        redirectUrl: `${origin}${SSO_CALLBACK_PATH}`,
        redirectUrlComplete: `${origin}/`,
      });
    } catch (e) {
      setError(
        e?.errors?.[0]?.longMessage ||
        e?.errors?.[0]?.message ||
        e?.message ||
        'Could not sign in. Please try again.'
      );
      setBusy(false);
    }
  };

  const firstName = (member?.name || '').trim().split(/\s+/)[0];

  return (
    <div style={{
      position: 'absolute', inset: 0, background: T.ink, zIndex: 48,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '32px 28px', overflow: 'hidden',
    }}>
      <div style={{
        fontSize: 10.5, letterSpacing: 3.4, fontWeight: 800,
        color: T.gold, textTransform: 'uppercase', textAlign: 'center',
      }}>
        Forbes Family Group
      </div>

      <h1 style={{
        margin: '18px 0 0', fontSize: 27, lineHeight: 1.2, fontWeight: 800,
        color: T.cream, textAlign: 'center', letterSpacing: -0.4,
      }}>
        {firstName ? `Almost in, ${firstName}.` : 'One last step.'}
      </h1>

      <p style={{
        margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.55, color: T.dim,
        textAlign: 'center', maxWidth: 330,
      }}>
        Verify it's really you. Members sign in with the Google account tied to
        their membership.
      </p>

      <button
        onClick={go}
        disabled={busy || !isLoaded}
        style={{
          marginTop: 32, width: '100%', maxWidth: 340, minHeight: 54,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
          background: busy ? T.card : `linear-gradient(135deg, ${T.gold}, ${T.goldSoft})`,
          color: busy ? T.dim : '#0A0A0D',
          border: `1px solid ${T.goldSoft}`, borderRadius: 999,
          fontSize: 15, fontWeight: 800, fontFamily: "'Inter',sans-serif",
          cursor: busy || !isLoaded ? 'default' : 'pointer',
          boxShadow: busy ? 'none' : `0 8px 28px ${T.gold}40`,
          transition: 'transform 0.15s, box-shadow 0.2s',
        }}
      >
        {busy ? 'Opening Google…' : (<><GoogleMark />Continue with Google</>)}
      </button>

      {!isLoaded && !busy && (
        <div style={{ marginTop: 14, fontSize: 12, color: T.dim }}>Connecting…</div>
      )}

      {error && (
        <div style={{
          marginTop: 18, maxWidth: 340, padding: '10px 14px', borderRadius: 12,
          background: 'rgba(220,80,80,0.10)', border: '1px solid rgba(220,80,80,0.35)',
          color: '#E88', fontSize: 12.5, lineHeight: 1.5, textAlign: 'center',
        }}>
          {error}
        </div>
      )}

      <div style={{
        marginTop: 30, fontSize: 11, lineHeight: 1.6, color: T.dim,
        textAlign: 'center', maxWidth: 320,
      }}>
        Members only. Your profile stays private to the group.
      </div>
    </div>
  );
}

/** Google's mark, drawn inline so there's no remote asset to load. */
const GoogleMark = () => (
  <svg width="19" height="19" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z" />
    <path fill="#34A853" d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.69 28.18C11.25 26.86 11 25.45 11 24s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z" />
    <path fill="#EA4335" d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z" />
  </svg>
);
