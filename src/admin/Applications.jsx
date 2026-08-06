/**
 * The membership front door, reviewed. Applications arrive here from the
 * public website; a decision is one tap, and the applicant hears by email
 * either way. Approve = member row + sign-up access + welcome email, all
 * done by the API in the same breath.
 */
import React, { useEffect, useState } from 'react';
import {
  T, Card, SectionTitle, Button, EmptyState, StatusChip, fontBody, fontHead, clip,
} from './ui.jsx';
import { api } from './api.js';

const ago = (iso) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

export default function Applications() {
  const [rows, setRows] = useState(null);
  const [busy, setBusy] = useState(null);   // id being decided
  const [error, setError] = useState('');

  const load = () => api.applications().then(({ applications }) => setRows(applications)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);

  const decide = async (id, action, name) => {
    const verb = action === 'approve' ? 'Approve' : 'Reject';
    if (!window.confirm(`${verb} ${name}? They will be emailed immediately.`)) return;
    setBusy(id);
    setError('');
    try {
      await (action === 'approve' ? api.approveApplication(id) : api.rejectApplication(id));
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const pending = (rows || []).filter(r => r.status === 'pending');
  const decided = (rows || []).filter(r => r.status !== 'pending');

  const Row = ({ r }) => (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 15.5, color: T.cream }}>{r.name}</span>
            {r.status !== 'pending' && <StatusChip status={r.status} />}
            {r.referred_by_name && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', fontFamily: fontBody,
                color: T.goldSoft, background: `${T.gold}18`, borderRadius: 999, padding: '3px 10px',
              }}>
                REFERRED BY {r.referred_by_name.toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ fontFamily: fontBody, fontSize: 13, color: T.dim, marginTop: 4, ...clip }}>
            {r.email}{r.phone ? ` · ${r.phone}` : ''} · {ago(r.created_at)}
          </div>
          {r.about && (
            <div style={{
              fontFamily: fontBody, fontSize: 13.5, color: T.cream, marginTop: 10,
              lineHeight: 1.55, background: T.ink, borderRadius: 12, padding: '10px 14px',
            }}>
              {r.about}
            </div>
          )}
          {r.status !== 'pending' && (
            <div style={{ fontFamily: fontBody, fontSize: 12, color: T.dim, marginTop: 8 }}>
              {r.status} by {r.decided_by || 'admin'} · {ago(r.decided_at)}
            </div>
          )}
        </div>
        {r.status === 'pending' && (
          <div style={{ display: 'flex', gap: 8 }}>
            <Button disabled={busy === r.id} onClick={() => decide(r.id, 'approve', r.name)}>
              {busy === r.id ? 'Working…' : 'Approve'}
            </Button>
            <Button kind="ghost" disabled={busy === r.id} onClick={() => decide(r.id, 'reject', r.name)}>
              Reject
            </Button>
          </div>
        )}
      </div>
    </Card>
  );

  return (
    <div>
      <SectionTitle
        eyebrow="Membership"
        title="Applications"
        right={pending.length ? `${pending.length} waiting` : null}
      />
      {error && (
        <div style={{ fontFamily: fontBody, fontSize: 13, color: '#B3261E', marginBottom: 12 }}>{error}</div>
      )}
      {rows === null && <EmptyState title="Loading…" />}
      {rows !== null && !pending.length && (
        <EmptyState title="No applications waiting" hint="New applications from the website appear here and by email." />
      )}
      {pending.map(r => <Row key={r.id} r={r} />)}

      {decided.length > 0 && (
        <>
          <div style={{
            fontFamily: fontBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em',
            color: T.dim, margin: '26px 0 12px',
          }}>
            DECIDED
          </div>
          {decided.map(r => <Row key={r.id} r={r} />)}
        </>
      )}
    </div>
  );
}
