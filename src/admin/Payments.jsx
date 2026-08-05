/**
 * The money screen. The ledger is the truth; Stripe is a way of settling
 * rows on it. Every action here writes the ledger first, so the export and
 * the revenue charts stay honest whichever way the money moved.
 */
import React, { useEffect, useState } from 'react';
import {
  T, Card, SectionTitle, Button, Input, Select, Field, Sheet, StatusChip,
  EmptyState, gbp, fontBody,
} from './ui.jsx';
import { api, getToken } from './api.js';

export default function Payments() {
  const [data, setData] = useState(null);
  const [members, setMembers] = useState([]);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);

  const load = () => Promise.all([api.payments(), api.members()])
    .then(([p, m]) => { setData(p); setMembers(m.members); })
    .catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  if (error) return <EmptyState title="Could not load payments" hint={error} />;
  if (!data) return <EmptyState title="Loading…" />;

  /* The CSV endpoint needs the bearer token, which a plain <a href> cannot
     carry — fetch it and hand the browser a blob instead. */
  const exportCsv = async () => {
    const res = await fetch(api.paymentsCsvUrl(), { headers: { Authorization: `Bearer ${getToken()}` } });
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'ffg-payments.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = (text) => navigator.clipboard?.writeText(text);

  return (
    <div>
      <SectionTitle
        eyebrow="MONEY"
        title="Payments"
        right={
          <div style={{ display: 'flex', gap: 10 }}>
            <Button kind="ghost" onClick={exportCsv}>Export CSV</Button>
            <Button onClick={() => setCreating(true)}>New payment</Button>
          </div>
        }
      />

      {!data.stripe.connected && (
        <Card style={{ marginBottom: 12, borderColor: `${T.gold}66`, background: `${T.gold}0D` }}>
          <span style={{ fontSize: 13, fontFamily: fontBody, color: T.cream }}>
            <strong>Stripe is not connected</strong> — new payments are recorded
            on the ledger and settled by hand. Add the keys and checkout links
            switch on with no other change.
          </span>
        </Card>
      )}
      {data.stripe.connected && data.stripe.test_mode && (
        <Card style={{ marginBottom: 12, borderColor: `${T.gold}66`, background: `${T.gold}0D` }}>
          <span style={{ fontSize: 13, fontFamily: fontBody, color: T.cream }}>
            <strong>Stripe test mode</strong> — links work end to end but no
            real money moves.
          </span>
        </Card>
      )}

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {data.payments.map((p, i) => (
          <div key={p.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
            borderTop: i ? `1px solid ${T.line}` : 'none', flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 0, flexBasis: '55%' }}>
              <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 14, color: T.cream }}>
                {p.member_name || 'Removed member'} · {gbp(p.amount_pence)}
              </div>
              <div style={{ fontSize: 12, color: T.dim, fontFamily: fontBody, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {p.description} · {p.method} · {new Date(p.created_at).toLocaleDateString('en-GB')}
              </div>
            </div>
            <StatusChip status={p.status} />
            {p.checkout_url && p.status === 'pending' && (
              <Button kind="ghost" style={{ padding: '8px 14px' }} onClick={() => copy(p.checkout_url)}>
                Copy pay link
              </Button>
            )}
            {p.status === 'pending' && (
              <Button kind="ghost" style={{ padding: '8px 14px' }}
                      onClick={() => api.setPaymentStatus(p.id, 'paid').then(load)}>
                Mark paid
              </Button>
            )}
            {p.status === 'pending' && (
              <Button kind="ghost" style={{ padding: '8px 14px', color: T.dim }}
                      onClick={() => api.setPaymentStatus(p.id, 'void').then(load)}>
                Void
              </Button>
            )}
          </div>
        ))}
        {!data.payments.length && (
          <EmptyState title="No payments yet"
                      hint="Create one — a Stripe link if connected, a ledger entry either way." />
        )}
      </Card>

      {creating && (
        <PaymentSheet members={members} stripeConnected={data.stripe.connected}
                      onClose={() => setCreating(false)}
                      onDone={() => { setCreating(false); load(); }} />
      )}
    </div>
  );
}

const PaymentSheet = ({ members, stripeConnected, onClose, onDone }) => {
  const [form, setForm] = useState({ member_id: members[0]?.id || '', amount: '', description: '', manual: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [made, setMade] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setError(null);
    const amount_pence = Math.round(parseFloat(form.amount) * 100);
    if (!Number.isInteger(amount_pence) || amount_pence <= 0) {
      setError('Enter an amount like 250 or 99.50');
      setBusy(false);
      return;
    }
    try {
      const body = { member_id: form.member_id, amount_pence, description: form.description };
      const payment = form.manual
        ? await api.recordManualPayment(body)
        : await api.createPayment(body);
      setMade(payment);
      setBusy(false);
    } catch (e) { setError(e.message); setBusy(false); }
  };

  if (made) {
    return (
      <Sheet title="Payment created" onClose={onDone}>
        <div style={{ fontSize: 13.5, fontFamily: fontBody, color: T.cream, lineHeight: 1.65, marginBottom: 16 }}>
          {made.checkout_url
            ? 'Send the member this link — the ledger updates itself when they pay.'
            : made.status === 'paid'
              ? 'Recorded as paid.'
              : 'Recorded on the ledger as pending. Mark it paid when the money arrives.'}
        </div>
        {made.checkout_url && (
          <Input readOnly value={made.checkout_url} onFocus={e => e.target.select()} style={{ marginBottom: 14 }} />
        )}
        <Button onClick={onDone} style={{ width: '100%' }}>Done</Button>
      </Sheet>
    );
  }

  return (
    <Sheet title="New payment" onClose={onClose}>
      <Field label="Member">
        <Select value={form.member_id} onChange={put('member_id')}>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </Select>
      </Field>
      <Field label="Amount (£)"><Input value={form.amount} onChange={put('amount')} placeholder="250.00" autoFocus /></Field>
      <Field label="What it's for"><Input value={form.description} onChange={put('description')} placeholder="Annual membership 2026" /></Field>
      {stripeConnected && (
        <label style={{ display: 'flex', gap: 9, alignItems: 'center', marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={form.manual} onChange={e => setForm(f => ({ ...f, manual: e.target.checked }))} />
          <span style={{ fontSize: 13, color: T.dim, fontFamily: fontBody }}>
            Record as already paid outside Stripe (bank transfer, cash)
          </span>
        </label>
      )}
      {error && <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 12 }}>{error}</div>}
      <Button onClick={submit} disabled={busy || !form.member_id || !form.amount || !form.description} style={{ width: '100%' }}>
        {busy ? 'Working…' : form.manual ? 'Record payment' : stripeConnected ? 'Create payment link' : 'Add to ledger'}
      </Button>
    </Sheet>
  );
};
