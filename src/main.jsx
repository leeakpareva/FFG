import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import FFGApp from './FFGApp.jsx';
import { CLERK_PUBLISHABLE_KEY, SSO_CALLBACK_PATH, NOT_A_MEMBER_PATH } from './clerkConfig.js';

/* Google returns here after the OAuth handshake. The SPA rewrite serves
   index.html for it, so we branch on the path before rendering the app. */
const path = window.location.pathname;
const isCallback = path.startsWith(SSO_CALLBACK_PATH);
const isNotAMember = path.startsWith(NOT_A_MEMBER_PATH);

const origin = window.location.origin;

/* Shared shell for the two interstitial screens, in the app's light theme. */
const Interstitial = ({ children }) => (
  <div style={{
    height: '100dvh', background: '#F7F4EE', color: '#17171B',
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '32px 28px', textAlign: 'center',
    fontFamily: "'Inter',sans-serif",
  }}>
    {children}
  </div>
);

const Eyebrow = () => (
  <div style={{
    fontSize: 10.5, letterSpacing: 3.4, fontWeight: 800,
    color: '#A8894E', textTransform: 'uppercase',
  }}>
    Forbes Family Group
  </div>
);

const Callback = () => (
  <Interstitial>
    {/* Members sign in; they never self-register. `transferable: false` stops
        Clerk turning an unrecognised Google account into a new sign-up, and the
        signUp* URLs keep any remaining path on our own domain rather than
        Clerk's hosted account portal. */}
    <AuthenticateWithRedirectCallback
      transferable={false}
      signInUrl={`${origin}/`}
      signUpUrl={`${origin}${NOT_A_MEMBER_PATH}`}
      signInFallbackRedirectUrl="/"
      signUpForceRedirectUrl={NOT_A_MEMBER_PATH}
      signUpFallbackRedirectUrl={NOT_A_MEMBER_PATH}
    />
    <Eyebrow />
    <div style={{ marginTop: 14, fontSize: 13, color: '#8A867C' }}>Signing you in…</div>
  </Interstitial>
);

/* Shown when the Google account used has no FFG membership behind it. */
const NotAMember = () => (
  <Interstitial>
    <Eyebrow />
    <h1 style={{
      margin: '18px 0 0', fontSize: 25, lineHeight: 1.25, fontWeight: 800,
      letterSpacing: -0.4,
    }}>
      We couldn't find your membership.
    </h1>
    <p style={{
      margin: '12px 0 0', fontSize: 14.5, lineHeight: 1.55,
      color: '#8A867C', maxWidth: 340,
    }}>
      FFG is invite-only, so accounts aren't created here. Please sign in with
      the Google account tied to your membership, or contact the team if you
      think this is a mistake.
    </p>
    <a
      href="/"
      style={{
        marginTop: 28, minWidth: 200, minHeight: 50, padding: '0 26px',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #A8894E, #8A6F3C)', color: '#FFF',
        border: '1px solid #8A6F3C', borderRadius: 999,
        fontSize: 15, fontWeight: 800, textDecoration: 'none',
      }}
    >
      Back to sign in
    </a>
  </Interstitial>
);

// No StrictMode: it double-invokes effects, which makes the one-shot OAuth
// callback fire twice.
createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    {isCallback ? <Callback /> : isNotAMember ? <NotAMember /> : <FFGApp />}
  </ClerkProvider>
);
