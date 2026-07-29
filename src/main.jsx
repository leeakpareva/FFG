import React from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider, AuthenticateWithRedirectCallback } from '@clerk/clerk-react';
import FFGApp from './FFGApp.jsx';
import { CLERK_PUBLISHABLE_KEY, SSO_CALLBACK_PATH } from './clerkConfig.js';

/* Google returns here after the OAuth handshake. The SPA rewrite serves
   index.html for it, so we branch on the path before rendering the app. */
const isCallback = window.location.pathname.startsWith(SSO_CALLBACK_PATH);

const Callback = () => (
  <div style={{
    height: '100dvh', background: '#0A0A0D', color: '#C8A867',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: "'Inter',sans-serif", fontSize: 11, letterSpacing: 3.4,
    fontWeight: 800, textTransform: 'uppercase',
  }}>
    <AuthenticateWithRedirectCallback
      signInFallbackRedirectUrl="/"
      signUpFallbackRedirectUrl="/"
    />
    Signing you in…
  </div>
);

// No StrictMode: it double-invokes effects, which makes the one-shot OAuth
// callback fire twice.
createRoot(document.getElementById('root')).render(
  <ClerkProvider publishableKey={CLERK_PUBLISHABLE_KEY} afterSignOutUrl="/">
    {isCallback ? <Callback /> : <FFGApp />}
  </ClerkProvider>
);
