/**
 * Team — named admin accounts and what each can reach.
 *
 * Superadmin-only. Accounts here are Ann, Charlene and whoever comes next;
 * each carries scopes ('website', 'marketing', 'applications') that open
 * the matching screens. The master env credential never appears here and
 * cannot be edited from here — it lives outside the database on purpose.
 */
import React, { useEffect, useState } from 'react';
import {
  T, Card, SectionTitle, Button, Input, Field, Sheet, EmptyState, fontBody, fontHead,
} from './ui.jsx';
import { api } from './api.js';

const SCOPE_LABELS = {
  website: 'Website',
  marketing: 'Marketing',
  applications: 'Applications',
};

const ScopePicker = ({ value, onChange, available }) => (
  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
    {available.map(s => {
      const on = value.includes(s);
      return (
        <button key={s} type="button"
          onClick={() => onChange(on ? value.filter(x => x !== s) : [...value, s])}
          style={{
            padding: '8px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: fontBody,
            fontWeight: 700, fontSize: 12.5,
            border: `1px solid ${on ? T.gold : T.line}`,
            background: on ? `${T.gold}18` : 'transparent',
            color: on ? T.goldSoft : T.dim,
          }}>
          {SCOPE_LABELS[s] || s}
        </button>
      );
    })}
  </div>
);

const blank = { username: '', display_name: '', password: '', scopes: ['website', 'marketing'] };

export default function Team() {
  const [team, setTeam] = useState(null);
  const [available, setAvailable] = useState(['website', 'marketing', 'applications']);
  const [editing, setEditing] = useState(null); // null | 'new' | account object
  const [draft, setDraft] = useState(blank);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.team().then(({ team, available_scopes }) => {
    setTeam(team);
    if (available_scopes?.length) setAvailable(available_scopes);
  }).catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const open = (acct) => {
    setError(null);
    if (acct) {
      setEditing(acct);
      setDraft({ username: acct.username, display_name: acct.display_name, password: '', scopes: acct.scopes || [] });
    } else {
      setEditing('new');
      setDraft(blank);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      if (editing === 'new') {
        await api.createTeamMember(draft);
      } else {
        const patch = { display_name: draft.display_name, scopes: draft.scopes };
        if (draft.password) patch.password = draft.password;
        await api.updateTeamMember(editing.username, patch);
      }
      setEditing(null);
      load();
    } catch (e) {
      setError(e.message);
    } finally { setBusy(false); }
  };

  const toggleDisabled = async (acct) => {
    await api.updateTeamMember(acct.username, { disabled: !acct.disabled }).catch(e => window.alert(e.message));
    load();
  };

  const remove = async (acct) => {
    if (!window.confirm(`Delete the account "${acct.display_name}"? They will no longer be able to sign in.`)) return;
    await api.deleteTeamMember(acct.username).catch(e => window.alert(e.message));
    load();
  };

  if (!team) return <EmptyState title={error ? 'Could not load the team' : 'Loading…'} hint={error} />;

  return (
    <div>
      <SectionTitle
        eyebrow="Access"
        title="Team"
        right={<Button onClick={() => open(null)}>Add account</Button>}
      />
      <div style={{ fontFamily: fontBody, fontSize: 13, color: T.dim, margin: '0 0 18px', lineHeight: 1.6 }}>
        Each account signs in with its own username and password and only sees the areas
        ticked here. Edits to the website record the editor's name.
      </div>

      {team.length === 0 && (
        <EmptyState title="No team accounts yet" hint="Add Ann and Charlene here — each gets their own login." />
      )}

      {team.map(acct => (
        <Card key={acct.username} style={{ marginBottom: 12, opacity: acct.disabled ? 0.55 : 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 180 }}>
              <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 15.5, color: T.cream }}>
                {acct.display_name}
                {acct.disabled && <span style={{ marginLeft: 8, fontSize: 10, letterSpacing: '0.1em', color: T.dim, fontFamily: fontBody }}>DISABLED</span>}
              </div>
              <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginTop: 3 }}>
                @{acct.username}
                {acct.last_login_at
                  ? ` · last signed in ${new Date(acct.last_login_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`
                  : ' · never signed in'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {(acct.scopes || []).map(s => (
                <span key={s} style={{
                  fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
                  color: T.goldSoft, background: `${T.gold}16`, padding: '3px 9px', borderRadius: 999, fontFamily: fontBody,
                }}>{SCOPE_LABELS[s] || s}</span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button kind="ghost" onClick={() => open(acct)}>Edit</Button>
              <Button kind="ghost" onClick={() => toggleDisabled(acct)}>{acct.disabled ? 'Enable' : 'Disable'}</Button>
              <Button kind="danger" onClick={() => remove(acct)}>Delete</Button>
            </div>
          </div>
        </Card>
      ))}

      {editing && (
        <Sheet title={editing === 'new' ? 'New account' : `Edit ${editing.display_name}`} onClose={() => setEditing(null)}>
          {editing === 'new' && (
            <Field label="Username">
              <Input value={draft.username} placeholder="ann"
                onChange={e => setDraft(d => ({ ...d, username: e.target.value.toLowerCase() }))} />
            </Field>
          )}
          <Field label="Name">
            <Input value={draft.display_name} placeholder="Ann-Marie"
              onChange={e => setDraft(d => ({ ...d, display_name: e.target.value }))} />
          </Field>
          <Field label={editing === 'new' ? 'Password (min 10 characters)' : 'New password (leave blank to keep)'}>
            <Input type="password" value={draft.password} autoComplete="new-password"
              onChange={e => setDraft(d => ({ ...d, password: e.target.value }))} />
          </Field>
          <Field label="Can access">
            <ScopePicker value={draft.scopes} available={available}
              onChange={scopes => setDraft(d => ({ ...d, scopes }))} />
          </Field>
          {error && <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 12 }}>{error}</div>}
          <Button onClick={save} disabled={busy || (editing === 'new' && (!draft.username || !draft.display_name || draft.password.length < 10))}>
            {busy ? 'Saving…' : 'Save'}
          </Button>
        </Sheet>
      )}
    </div>
  );
}
