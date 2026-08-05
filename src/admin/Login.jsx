/**
 * The door. Deliberately quiet: no branding beyond the mark, one generic
 * error for every kind of failure, nothing that tells a visitor what this
 * is the door to.
 */
import React, { useState } from 'react';
import { T, AgentMark, Button, Input, Field, fontHead, fontBody } from './ui.jsx';
import { api } from './api.js';

export default function Login({ onIn }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.login(username.trim(), password);
      onIn();
    } catch (err) {
      setError(err.status === 429 ? 'Too many attempts. Try again in a few minutes.' : 'That didn’t work.');
    }
    setBusy(false);
  };

  return (
    <div style={{
      minHeight: '100dvh', background: T.ink, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <form onSubmit={submit} style={{ width: 'min(88vw, 360px)' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}>
          <AgentMark size={40} />
        </div>
        <div style={{
          fontFamily: fontHead, fontWeight: 900, fontSize: 22, color: T.cream,
          textAlign: 'center', marginBottom: 26, letterSpacing: '-0.01em',
        }}>
          Sign in
        </div>
        <Field label="Username">
          <Input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" autoFocus />
        </Field>
        <Field label="Password">
          <Input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
        </Field>
        {error && (
          <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 14, textAlign: 'center' }}>
            {error}
          </div>
        )}
        <Button type="submit" disabled={busy || !username || !password} style={{ width: '100%' }}>
          {busy ? 'Signing in…' : 'Sign in'}
        </Button>
      </form>
    </div>
  );
}
