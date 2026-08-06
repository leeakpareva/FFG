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

/** Whole years old, from a date of birth. */
const age = (dob) => {
  const d = new Date(dob), now = new Date();
  let years = now.getFullYear() - d.getFullYear();
  const before = now.getMonth() < d.getMonth() || (now.getMonth() === d.getMonth() && now.getDate() < d.getDate());
  return before ? years - 1 : years;
};

const ago = (iso) => {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
};

/**
 * Where the membership fee stands. A held card authorisation lapses after
 * about 7 days — the chip counts, so the queue shows what needs deciding
 * first.
 */
const PaymentChip = ({ r }) => {
  if (!r.payment_status || r.payment_status === 'none') return null;
  const amount = r.amount_pence ? `£${(r.amount_pence / 100).toFixed(0)}` : '';
  const planWord = r.plan === 'annual' ? 'ANNUAL' : r.plan === 'quarterly' ? 'QUARTERLY' : '';
  const heldDays = r.payment_held_at
    ? Math.floor((Date.now() - new Date(r.payment_held_at).getTime()) / 86400000)
    : null;
  const map = {
    unpaid: { c: T.dim, label: 'AWAITING PAYMENT' },
    held: {
      c: heldDays !== null && heldDays >= 5 ? '#B3261E' : T.gold,
      label: `HELD ${amount} ${planWord}${heldDays !== null ? ` · DAY ${heldDays + 1} OF 7` : ''}`,
    },
    captured: { c: T.community, label: `PAID ${amount} ${planWord}` },
    released: { c: T.connect, label: 'HOLD RELEASED' },
    capture_failed: { c: '#B3261E', label: 'PAYMENT FAILED — FOLLOW UP' },
  };
  const m = map[r.payment_status];
  if (!m) return null;
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', fontFamily: fontBody,
      color: m.c, background: `${m.c}16`, borderRadius: 999, padding: '3px 10px',
      whiteSpace: 'nowrap',
    }}>{m.label.trim()}</span>
  );
};

export default function Applications() {
  const [rows, setRows] = useState(null);
  const [reviewers, setReviewers] = useState([]);
  const [busy, setBusy] = useState(null);   // id being decided
  const [error, setError] = useState('');

  const load = () => api.applications().then(({ applications }) => setRows(applications)).catch(() => setRows([]));
  useEffect(() => {
    load();
    api.reviewers().then(({ reviewers }) => setReviewers(reviewers)).catch(() => {});
  }, []);

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

  const shortlist = async (id, undo) => {
    setBusy(id);
    try {
      await (undo ? api.unshortlistApplication(id) : api.shortlistApplication(id));
      await load();
    } catch (e) { setError(e.message); } finally { setBusy(null); }
  };

  const assign = async (id, who) => {
    try {
      await api.assignApplication(id, who || null);
      await load();
    } catch (e) { setError(e.message); }
  };

  const addNote = async (id) => {
    const text = window.prompt('Note for the team (the applicant never sees this):');
    if (!text?.trim()) return;
    try {
      await api.addApplicationNote(id, text.trim());
      await load();
    } catch (e) { setError(e.message); }
  };

  const pending = (rows || []).filter(r => r.status === 'pending');
  const shortlisted = (rows || []).filter(r => r.status === 'shortlisted');
  const started = (rows || []).filter(r => r.status === 'awaiting_details');
  const decided = (rows || []).filter(r => r.status === 'approved' || r.status === 'rejected');

  const Row = ({ r }) => (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontFamily: fontHead, fontWeight: 700, fontSize: 15.5, color: T.cream }}>{r.name}</span>
            {r.status !== 'pending' && <StatusChip status={r.status} />}
            {r.details_done_at && r.status === 'pending' && (
              <span style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', color: T.community, fontFamily: fontBody }}>
                COMPLETE
              </span>
            )}
            <PaymentChip r={r} />
            {r.assigned_to && (
              <span style={{
                fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', fontFamily: fontBody,
                color: T.connect, background: `${T.connect}16`, borderRadius: 999, padding: '3px 10px',
              }}>
                {(reviewers.find(rv => rv.username === r.assigned_to)?.name || r.assigned_to).toUpperCase()}
              </span>
            )}
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

          {(r.descriptor || r.industry || r.organisation) && (
            <div style={{ fontFamily: fontBody, fontSize: 13.5, color: T.cream, marginTop: 8, lineHeight: 1.5 }}>
              {[r.role_title, r.organisation].filter(Boolean).join(' at ')}
              {r.industry ? <span style={{ color: T.dim }}> · {r.industry}</span> : null}
              {r.descriptor ? <span style={{ color: T.dim }}> · {r.descriptor}</span> : null}
            </div>
          )}

          {(r.date_of_birth || r.nationality || r.identifies_as) && (
            <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginTop: 5 }}>
              {[
                r.date_of_birth ? `${age(r.date_of_birth)} years` : null,
                r.nationality,
                r.identifies_as,
                r.marketing_opt_in ? 'Happy to be contacted' : null,
              ].filter(Boolean).join(' · ')}
            </div>
          )}

          {r.referred_by && !r.referred_by_name && (
            <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginTop: 5 }}>
              Says they were referred by <span style={{ color: T.cream }}>{r.referred_by}</span>
            </div>
          )}

          {(r.linkedin_url || r.instagram_handle || r.website_url) && (
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 8 }}>
              {[
                r.linkedin_url && ['LinkedIn', r.linkedin_url],
                r.instagram_handle && ['Instagram', `https://instagram.com/${r.instagram_handle}`],
                r.website_url && ['Website', r.website_url],
              ].filter(Boolean).map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noreferrer" style={{
                  fontFamily: fontBody, fontSize: 12.5, fontWeight: 700, color: T.goldSoft,
                }}>{label} ↗</a>
              ))}
            </div>
          )}

          {[
            ['Why they want to join', r.about],
            ['Their story', r.story],
            ['What they would bring, and hope to gain', r.contribution],
            ['What would make it worth it', r.worth_it],
          ].filter(([, v]) => v).map(([label, value]) => (
            <div key={label} style={{ marginTop: 10 }}>
              <div style={{ fontFamily: fontBody, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: T.dim, marginBottom: 4 }}>
                {label.toUpperCase()}
              </div>
              <div style={{
                fontFamily: fontBody, fontSize: 13.5, color: T.cream, lineHeight: 1.55,
                background: T.ink, borderRadius: 12, padding: '10px 14px', whiteSpace: 'pre-wrap',
              }}>
                {value}
              </div>
            </div>
          ))}

          {(r.income_bracket || r.heard_about) && (
            <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginTop: 8 }}>
              {[
                r.income_bracket ? `Income: ${r.income_bracket}` : null,
                r.heard_about ? `Heard about us: ${r.heard_about}` : null,
              ].filter(Boolean).join(' · ')}
            </div>
          )}
          {(r.status === 'approved' || r.status === 'rejected') && (
            <div style={{ fontFamily: fontBody, fontSize: 12, color: T.dim, marginTop: 8 }}>
              {r.status} by {r.decided_by || 'admin'} · {ago(r.decided_at)}
            </div>
          )}

          {(r.notes || []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontFamily: fontBody, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.08em', color: T.dim, marginBottom: 4 }}>
                TEAM NOTES
              </div>
              {r.notes.map((n, i) => (
                <div key={i} style={{
                  fontFamily: fontBody, fontSize: 13, color: T.cream, lineHeight: 1.5,
                  background: T.ink, borderRadius: 12, padding: '8px 12px', marginBottom: 6,
                }}>
                  {n.text}
                  <span style={{ color: T.dim, fontSize: 11.5 }}> — {n.by}, {ago(n.at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {(r.status === 'pending' || r.status === 'shortlisted') && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button disabled={busy === r.id} onClick={() => decide(r.id, 'approve', r.name)}>
                {busy === r.id ? 'Working…' : 'Approve'}
              </Button>
              <Button kind="ghost" disabled={busy === r.id} onClick={() => decide(r.id, 'reject', r.name)}>
                Reject
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="ghost" style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }}
                      disabled={busy === r.id}
                      onClick={() => shortlist(r.id, r.status === 'shortlisted')}>
                {r.status === 'shortlisted' ? 'Back to queue' : 'Shortlist'}
              </Button>
              <Button kind="ghost" style={{ flex: 1, padding: '9px 12px', fontSize: 12.5 }}
                      onClick={() => addNote(r.id)}>
                Add note
              </Button>
            </div>
            <select value={r.assigned_to || ''} onChange={e => assign(r.id, e.target.value)} style={{
              padding: '9px 10px', borderRadius: 10, border: `1px solid ${T.line}`, background: T.card,
              color: r.assigned_to ? T.cream : T.dim, fontSize: 12.5, fontFamily: fontBody,
            }}>
              <option value="">Unassigned</option>
              {reviewers.map(rv => <option key={rv.username} value={rv.username}>{rv.name}</option>)}
            </select>
          </div>
        )}
        {(r.status === 'approved' || r.status === 'rejected') && (
          <Button kind="ghost" style={{ padding: '9px 12px', fontSize: 12.5 }} onClick={() => addNote(r.id)}>
            Add note
          </Button>
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
        <EmptyState title="No applications waiting" hint="Completed applications from the website appear here and by email." />
      )}
      {pending.map(r => <Row key={r.id} r={r} />)}

      {shortlisted.length > 0 && (
        <>
          <div style={{
            fontFamily: fontBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em',
            color: T.goldSoft, margin: '26px 0 12px',
          }}>
            SHORTLISTED
          </div>
          {shortlisted.map(r => <Row key={r.id} r={r} />)}
        </>
      )}

      {started.length > 0 && (
        <>
          <div style={{
            fontFamily: fontBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.14em',
            color: T.dim, margin: '26px 0 6px',
          }}>
            STARTED, NOT FINISHED
          </div>
          <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginBottom: 12, lineHeight: 1.5 }}>
            They have completed part one and been emailed a link to finish. There is
            nothing to decide until they do.
          </div>
          {started.map(r => <Row key={r.id} r={r} />)}
        </>
      )}

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
