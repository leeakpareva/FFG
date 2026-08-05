/**
 * People. The one screen where every action lands on a real person, so the
 * dangerous ones are slowed down: deleting a member means typing their
 * handle first, and there is no bulk anything.
 */
import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts';
import {
  T, CHART, Card, SectionTitle, Avatar, PillarTag, Button, Input, Select,
  Field, Sheet, StatusChip, EmptyState, gbp, clip, fontBody, fontHead,
} from './ui.jsx';
import { api } from './api.js';

const ago = (d) => {
  if (!d) return 'never';
  const mins = (Date.now() - new Date(d).getTime()) / 60_000;
  if (mins < 60) return `${Math.max(1, Math.round(mins))}m ago`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h ago`;
  return `${Math.round(mins / 60 / 24)}d ago`;
};

export default function Members() {
  const [members, setMembers] = useState(null);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState(null);   // member being edited
  const [inviting, setInviting] = useState(false);
  const [deleting, setDeleting] = useState(null); // member pending delete
  const [insight, setInsight] = useState(null);   // member whose drill-down is open
  const [error, setError] = useState(null);

  const load = () => api.members().then(({ members }) => setMembers(members)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <EmptyState title="Could not load members" hint={error} />;
  if (!members) return <EmptyState title="Loading…" />;

  const shown = members.filter(m =>
    !filter || [m.name, m.handle, m.email, m.role].join(' ').toLowerCase().includes(filter.toLowerCase()));

  return (
    <div>
      <SectionTitle
        eyebrow="PEOPLE"
        title={`Members · ${members.length}`}
        right={<Button onClick={() => setInviting(true)}>Add member</Button>}
      />

      <Input placeholder="Search name, handle, email…" value={filter}
             onChange={e => setFilter(e.target.value)} style={{ marginBottom: 12, maxWidth: 380 }} />

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {shown.map((m, i) => (
          /* Two decks: identity on top, actions underneath. It reads the
             same on a phone and a monitor — nothing floats, nothing wraps
             mid-sentence, long emails clip instead of shoving the layout. */
          <div key={m.id} style={{ padding: '13px 16px', borderTop: i ? `1px solid ${T.line}` : 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar initials={m.id} src={m.avatar_url} size={42} />
              <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => setInsight(m)}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 14.5, color: T.cream }}>{m.name}</span>
                  {m.is_admin && <Tag color={T.gold}>admin</Tag>}
                  {m.verified && <Tag color={T.connect}>verified</Tag>}
                  {!m.has_signed_in && <Tag color={T.dim}>invited</Tag>}
                </div>
                <div style={{ fontSize: 12, color: T.dim, fontFamily: fontBody, ...clip }}>
                  @{m.handle} · {m.email || 'no email'} · {m.role}
                </div>
              </div>
              <PillarTag name={m.pillar} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 9, paddingLeft: 54 }}>
              <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: T.dim, fontFamily: fontBody, ...clip }}>
                {ago(m.last_seen)} · {m.actions_30d} actions/30d
              </span>
              <Button kind="ghost" onClick={() => setInsight(m)} style={{ padding: '7px 14px', fontSize: 12.5 }}>Insight</Button>
              <Button kind="ghost" onClick={() => setEditing({ ...m })} style={{ padding: '7px 14px', fontSize: 12.5 }}>Edit</Button>
            </div>
          </div>
        ))}
        {!shown.length && <EmptyState title="No members match" />}
      </Card>

      {inviting && <InviteSheet onClose={() => setInviting(false)} onDone={() => { setInviting(false); load(); }} />}
      {editing && (
        <EditSheet member={editing} onClose={() => setEditing(null)}
                   onDone={() => { setEditing(null); load(); }}
                   onDelete={() => { setDeleting(editing); setEditing(null); }} />
      )}
      {deleting && (
        <DeleteSheet member={deleting} onClose={() => setDeleting(null)}
                     onDone={() => { setDeleting(null); load(); }} />
      )}
      {insight && <InsightSheet member={insight} onClose={() => setInsight(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------- drill-down */

const ACTIVITY_LABELS = {
  active: 'Opened the app', room_join: 'Joined a room', room_leave: 'Left a room',
  media_upload: 'Uploaded a photo', article_read: 'Read an article',
  concierge_ask: 'Asked the Concierge', post_created: 'Posted to the feed',
  message_sent: 'Sent a message', follow: 'Followed someone',
  member_created: 'Joined Connect', payment_paid: 'Made a payment',
  event_rsvp: 'RSVP’d to an event', event_paid: 'Paid for an event',
};

const InsightSheet = ({ member, onClose }) => {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [sendState, setSendState] = useState('idle'); // idle | busy | sent

  useEffect(() => {
    api.memberInsight(member.id).then(setData).catch(e => setError(e.message));
  }, [member.id]);

  const send = async () => {
    if (!message.trim() || sendState === 'busy') return;
    setSendState('busy');
    try {
      await api.messageMember(member.id, message.trim());
      setMessage('');
      setSendState('sent');
      setTimeout(() => setSendState('idle'), 2500);
    } catch (e) {
      setError(e.message);
      setSendState('idle');
    }
  };

  if (error) return <Sheet title={member.name} onClose={onClose}><EmptyState title="Could not load" hint={error} /></Sheet>;
  if (!data) return <Sheet title={member.name} onClose={onClose}><EmptyState title="Loading…" /></Sheet>;

  const m = data.member;
  const minutesRows = data.minutes_daily.map(r => ({
    day: new Date(r.day).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
    minutes: r.minutes,
  }));

  return (
    <Sheet title={m.name} onClose={onClose} wide>
      <div style={{ display: 'flex', alignItems: 'center', gap: 13, marginBottom: 16 }}>
        <Avatar initials={m.id} src={m.avatar_url} size={52} />
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: fontBody, fontSize: 13, color: T.dim }}>
            @{m.handle} · {m.role} · joined {new Date(m.created_at).toLocaleDateString('en-GB')}
          </div>
          <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim }}>
            last seen {ago(m.last_seen)} · {m.has_signed_in ? 'signed in' : 'invited, not signed in yet'}
          </div>
        </div>
        <PillarTag name={m.pillar} />
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        {[
          [`${data.minutes_total_14d}m`, 'in app · 14d'],
          [m.posts, 'posts'], [m.followers, 'followers'],
          [m.following, 'following'], [m.messages_sent, 'messages'],
          [data.events.length, 'events'],
        ].map(([v, l]) => (
          <div key={l} style={{ flex: 1, minWidth: 86, background: T.ink, border: `1px solid ${T.line}`, borderRadius: 12, padding: '10px 12px' }}>
            <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 18, color: T.cream }}>{v}</div>
            <div style={{ fontSize: 10.5, color: T.dim, fontFamily: fontBody }}>{l}</div>
          </div>
        ))}
      </div>

      <InsightLabel>Time in app — last 14 days</InsightLabel>
      {minutesRows.length ? (
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={minutesRows} margin={{ top: 4, right: 8, bottom: 0, left: -26 }}>
            <CartesianGrid stroke={CHART.grid} vertical={false} />
            <XAxis dataKey="day" tick={{ fontSize: 10, fontFamily: fontBody, fill: T.dim }} tickLine={false} axisLine={{ stroke: T.line }} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fontFamily: fontBody, fill: T.dim }} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip contentStyle={{ background: T.card, border: `1px solid ${T.line}`, borderRadius: 10, fontFamily: fontBody, fontSize: 12 }}
                     formatter={(v) => [`${v} min`, 'Time in app']} />
            <Bar dataKey="minutes" fill={CHART.single} stroke={T.card} strokeWidth={2} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      ) : <div style={{ fontSize: 12.5, color: T.dim, fontFamily: fontBody, marginBottom: 8 }}>Nothing recorded yet.</div>}

      <InsightLabel>Send them a message</InsightLabel>
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <Input placeholder={`Message ${m.name.split(' ')[0]} — arrives in their DMs`}
               value={message} onChange={e => setMessage(e.target.value)}
               onKeyDown={e => e.key === 'Enter' && send()} />
        <Button onClick={send} disabled={!message.trim() || sendState === 'busy'}>
          {sendState === 'busy' ? 'Sending…' : sendState === 'sent' ? 'Sent ✓' : 'Send'}
        </Button>
      </div>

      {data.payments.length > 0 && (
        <>
          <InsightLabel>Payments</InsightLabel>
          <div style={{ marginBottom: 16 }}>
            {data.payments.map(p => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: `1px solid ${T.line}` }}>
                <span style={{ flex: 1, fontSize: 12.5, fontFamily: fontBody, color: T.cream }}>{p.description}</span>
                <span style={{ fontSize: 12.5, fontFamily: fontBody, fontWeight: 700, color: T.cream }}>{gbp(p.amount_pence)}</span>
                <StatusChip status={p.status} />
              </div>
            ))}
          </div>
        </>
      )}

      <InsightLabel>Recent activity</InsightLabel>
      {data.recent_activity.length ? (
        <div>
          {data.recent_activity.slice(0, 20).map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: `1px solid ${T.line}` }}>
              <span style={{ flex: 1, fontSize: 12.5, fontFamily: fontBody, color: T.cream }}>
                {ACTIVITY_LABELS[a.type] || a.type}
                {a.meta?.room ? ` — ${a.meta.room}` : a.meta?.article ? ` — ${a.meta.article}` : a.meta?.event ? ` — ${a.meta.event}` : ''}
              </span>
              <span style={{ fontSize: 11.5, fontFamily: fontBody, color: T.dim }}>{ago(a.created_at)}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ fontSize: 12.5, color: T.dim, fontFamily: fontBody }}>Nothing yet — this fills in as they use the app.</div>}
    </Sheet>
  );
};

const InsightLabel = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: T.dim, fontFamily: fontBody, margin: '4px 0 8px',
  }}>{children}</div>
);

const Tag = ({ children, color }) => (
  <span style={{
    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color, background: `${color}16`, padding: '2px 7px', borderRadius: 999, fontFamily: fontBody,
  }}>{children}</span>
);

const InviteSheet = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ name: '', email: '', role: 'Member', pillar: 'Community' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setError(null);
    try { await api.inviteMember(form); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title="Add a member" onClose={onClose}>
      <div style={{ fontSize: 12.5, color: T.dim, fontFamily: fontBody, marginBottom: 16, lineHeight: 1.6 }}>
        Creates their membership now. The first time they sign in with Google
        using this email, the account connects automatically.
      </div>
      <Field label="Full name"><Input value={form.name} onChange={put('name')} autoFocus /></Field>
      <Field label="Email"><Input type="email" value={form.email} onChange={put('email')} /></Field>
      <Field label="Role shown on their card"><Input value={form.role} onChange={put('role')} placeholder="Founder · Acme" /></Field>
      <Field label="Pillar">
        <Select value={form.pillar} onChange={put('pillar')}>
          <option>Capital</option><option>Community</option><option>Connect</option>
        </Select>
      </Field>
      {error && <ErrorLine text={error} />}
      <Button onClick={submit} disabled={busy || !form.name || !form.email} style={{ width: '100%' }}>
        {busy ? 'Adding…' : 'Add member'}
      </Button>
    </Sheet>
  );
};

const EditSheet = ({ member, onClose, onDone, onDelete }) => {
  const [form, setForm] = useState({
    name: member.name, handle: member.handle, role: member.role,
    pillar: member.pillar, bio: member.bio || '',
    verified: member.verified, is_admin: member.is_admin,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const toggle = (k) => () => setForm(f => ({ ...f, [k]: !f[k] }));

  const submit = async () => {
    setBusy(true); setError(null);
    try { await api.updateMember(member.id, form); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title={`Edit ${member.name}`} onClose={onClose}>
      <Field label="Name"><Input value={form.name} onChange={put('name')} /></Field>
      <Field label="Handle"><Input value={form.handle} onChange={put('handle')} /></Field>
      <Field label="Role"><Input value={form.role} onChange={put('role')} /></Field>
      <Field label="Pillar">
        <Select value={form.pillar} onChange={put('pillar')}>
          <option>Capital</option><option>Community</option><option>Connect</option>
        </Select>
      </Field>
      <Field label="Bio"><Input value={form.bio} onChange={put('bio')} /></Field>
      <div style={{ display: 'flex', gap: 10, marginBottom: 18 }}>
        <Toggle on={form.verified} onClick={toggle('verified')} label="Verified badge" />
        <Toggle on={form.is_admin} onClick={toggle('is_admin')} label="App admin" />
      </div>
      {error && <ErrorLine text={error} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button onClick={submit} disabled={busy} style={{ flex: 1 }}>{busy ? 'Saving…' : 'Save'}</Button>
        <Button kind="danger" onClick={onDelete}>Delete…</Button>
      </div>
    </Sheet>
  );
};

const DeleteSheet = ({ member, onClose, onDone }) => {
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const armed = confirm === member.handle;

  const submit = async () => {
    setBusy(true); setError(null);
    try { await api.deleteMember(member.id); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title="Delete member" onClose={onClose}>
      <div style={{ fontSize: 13.5, color: T.cream, fontFamily: fontBody, lineHeight: 1.65, marginBottom: 16 }}>
        This removes <strong>{member.name}</strong> completely: their profile,
        posts, uploads and sign-in. It cannot be undone.
      </div>
      <Field label={`Type their handle — ${member.handle} — to confirm`}>
        <Input value={confirm} onChange={e => setConfirm(e.target.value)} autoFocus />
      </Field>
      {error && <ErrorLine text={error} />}
      <Button kind="danger" onClick={submit} disabled={!armed || busy} style={{ width: '100%' }}>
        {busy ? 'Deleting…' : 'Delete permanently'}
      </Button>
    </Sheet>
  );
};

const Toggle = ({ on, onClick, label }) => (
  <button onClick={onClick} type="button" style={{
    flex: 1, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
    border: `1px solid ${on ? T.gold : T.line}`,
    background: on ? `${T.gold}14` : 'transparent',
    color: on ? T.goldSoft : T.dim, fontFamily: fontBody, fontWeight: 600, fontSize: 12.5,
  }}>{on ? '✓ ' : ''}{label}</button>
);

const ErrorLine = ({ text }) => (
  <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 12 }}>{text}</div>
);
