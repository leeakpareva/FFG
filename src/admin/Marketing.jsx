/**
 * Marketing — campaigns and the asset library.
 *
 * A campaign is the plan: goal, audience, channels, dates, budget, brief,
 * and a tracked link (UTM) so results can be read in analytics later.
 * Assets are files — photos, video, PDFs, decks — kept in one library,
 * taggable and optionally filed under a campaign.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  T, Card, SectionTitle, Button, Input, TextArea, Select, Field, Sheet, EmptyState,
  fontBody, fontHead, bytes,
} from './ui.jsx';
import { api, API_BASE } from './api.js';

const SITE_URL = 'https://forbes-family-group.vercel.app';

const STATUSES = ['draft', 'planned', 'active', 'completed', 'archived'];
const STATUS_COLOR = {
  draft: T.dim, planned: T.connect, active: T.community, completed: T.gold, archived: T.dim,
};
const CHANNELS = ['Instagram', 'LinkedIn', 'Email', 'Events', 'Press', 'Partnerships', 'Website', 'Other'];
/* One agreed value per channel keeps analytics clean — lowercase, always. */
const CHANNEL_UTM = {
  Instagram: { source: 'instagram', medium: 'social' },
  LinkedIn: { source: 'linkedin', medium: 'social' },
  Email: { source: 'email', medium: 'email' },
  Events: { source: 'event', medium: 'offline' },
  Press: { source: 'press', medium: 'referral' },
  Partnerships: { source: 'partner', medium: 'referral' },
  Website: { source: 'site', medium: 'referral' },
  Other: { source: 'other', medium: 'other' },
};

const StatusTag = ({ status }) => (
  <span style={{
    fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase',
    color: STATUS_COLOR[status] || T.dim, background: `${STATUS_COLOR[status] || T.dim}16`,
    padding: '3px 9px', borderRadius: 999, fontFamily: fontBody,
  }}>{status}</span>
);

const ChannelPicker = ({ value, onChange }) => (
  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
    {CHANNELS.map(c => {
      const on = value.includes(c);
      return (
        <button key={c} type="button"
          onClick={() => onChange(on ? value.filter(x => x !== c) : [...value, c])}
          style={{
            padding: '7px 13px', borderRadius: 999, cursor: 'pointer', fontFamily: fontBody,
            fontWeight: 600, fontSize: 12.5,
            border: `1px solid ${on ? T.gold : T.line}`,
            background: on ? `${T.gold}18` : 'transparent',
            color: on ? T.goldSoft : T.dim,
          }}>{c}</button>
      );
    })}
  </div>
);

const CopyButton = ({ text }) => {
  const [done, setDone] = useState(false);
  return (
    <Button kind="ghost" style={{ padding: '7px 14px', fontSize: 12 }} onClick={async () => {
      try {
        await navigator.clipboard.writeText(text);
        setDone(true);
        setTimeout(() => setDone(false), 1400);
      } catch { window.prompt('Copy:', text); }
    }}>{done ? 'Copied ✓' : 'Copy'}</Button>
  );
};

/** Tracked links for a campaign: one per selected channel, ready to paste. */
const UtmLinks = ({ campaign }) => {
  const channels = campaign.channels?.length ? campaign.channels : ['Other'];
  const slug = campaign.utm_campaign || 'campaign';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: T.dim, textTransform: 'uppercase', fontFamily: fontBody, marginBottom: 8 }}>
        Tracked links — paste these wherever the campaign goes out
      </div>
      {channels.map(c => {
        const u = CHANNEL_UTM[c] || CHANNEL_UTM.Other;
        const link = `${SITE_URL}/?utm_source=${u.source}&utm_medium=${u.medium}&utm_campaign=${slug}`;
        return (
          <div key={c} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: fontBody, fontSize: 12, color: T.cream, fontWeight: 600, width: 92 }}>{c}</span>
            <code style={{
              flex: 1, minWidth: 200, fontSize: 11.5, color: T.dim, background: T.ink,
              padding: '7px 10px', borderRadius: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{link}</code>
            <CopyButton text={link} />
          </div>
        );
      })}
    </div>
  );
};

const blankCampaign = {
  name: '', status: 'draft', objective: '', audience: '', channels: [],
  start_date: '', end_date: '', budget: '', brief: '',
};

/* ----------------------------------------------------------- campaigns */

function Campaigns() {
  const [campaigns, setCampaigns] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | campaign
  const [draft, setDraft] = useState(blankCampaign);
  const [expanded, setExpanded] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const load = () => api.campaigns().then(({ campaigns }) => setCampaigns(campaigns)).catch(e => setError(e.message));
  useEffect(() => { load(); }, []);

  const open = (c) => {
    setError(null);
    if (c) {
      setEditing(c);
      setDraft({
        name: c.name, status: c.status, objective: c.objective, audience: c.audience,
        channels: c.channels || [], start_date: c.start_date?.slice(0, 10) || '',
        end_date: c.end_date?.slice(0, 10) || '',
        budget: c.budget_pence != null ? String(c.budget_pence / 100) : '', brief: c.brief,
      });
    } else {
      setEditing('new');
      setDraft(blankCampaign);
    }
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    const body = {
      name: draft.name, status: draft.status, objective: draft.objective, audience: draft.audience,
      channels: draft.channels,
      start_date: draft.start_date || null, end_date: draft.end_date || null,
      budget_pence: draft.budget === '' ? null : Math.round(Number(draft.budget) * 100),
      brief: draft.brief,
    };
    try {
      if (editing === 'new') await api.createCampaign(body);
      else await api.updateCampaign(editing.id, body);
      setEditing(null);
      load();
    } catch (e) { setError(e.message); } finally { setBusy(false); }
  };

  const remove = async (c) => {
    if (!window.confirm(`Delete the campaign "${c.name}"? Its assets stay in the library.`)) return;
    await api.deleteCampaign(c.id).catch(e => window.alert(e.message));
    load();
  };

  if (!campaigns) return <EmptyState title={error ? 'Could not load campaigns' : 'Loading…'} hint={error} />;

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
        <Button onClick={() => open(null)}>New campaign</Button>
      </div>

      {campaigns.length === 0 && (
        <EmptyState title="No campaigns yet"
          hint="A campaign holds the goal, audience, channels, dates and brief in one place — start with the next thing FFG is promoting." />
      )}

      {campaigns.map(c => {
        const isOpen = expanded === c.id;
        const dates = [fmtDate(c.start_date), fmtDate(c.end_date)].filter(Boolean).join(' → ');
        return (
          <Card key={c.id} style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : c.id)}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 16, color: T.cream }}>{c.name}</div>
                <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginTop: 4 }}>
                  {[dates, c.channels?.join(' · '), `${c.asset_count} asset${c.asset_count === 1 ? '' : 's'}`]
                    .filter(Boolean).join('  ·  ')}
                </div>
              </div>
              <StatusTag status={c.status} />
              <span style={{ color: T.dim, fontSize: 13 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop: 14, borderTop: `1px solid ${T.line}`, paddingTop: 14 }}>
                {c.objective && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: T.dim, textTransform: 'uppercase', fontFamily: fontBody }}>Goal — </span>
                    <span style={{ fontFamily: fontBody, fontSize: 13.5, color: T.cream }}>{c.objective}</span>
                  </div>
                )}
                {c.audience && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: T.dim, textTransform: 'uppercase', fontFamily: fontBody }}>Audience — </span>
                    <span style={{ fontFamily: fontBody, fontSize: 13.5, color: T.cream }}>{c.audience}</span>
                  </div>
                )}
                {c.budget_pence != null && (
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: T.dim, textTransform: 'uppercase', fontFamily: fontBody }}>Budget — </span>
                    <span style={{ fontFamily: fontBody, fontSize: 13.5, color: T.cream }}>£{(c.budget_pence / 100).toLocaleString('en-GB')}</span>
                  </div>
                )}
                {c.brief && (
                  <div style={{ fontFamily: fontBody, fontSize: 13.5, color: T.cream, lineHeight: 1.6, whiteSpace: 'pre-wrap', marginBottom: 6 }}>
                    {c.brief}
                  </div>
                )}
                <UtmLinks campaign={c} />
                <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                  <Button kind="ghost" onClick={(e) => { e.stopPropagation(); open(c); }}>Edit</Button>
                  <Button kind="danger" onClick={(e) => { e.stopPropagation(); remove(c); }}>Delete</Button>
                </div>
                <div style={{ fontFamily: fontBody, fontSize: 11.5, color: T.dim, marginTop: 10 }}>
                  Created by {c.created_by}
                </div>
              </div>
            )}
          </Card>
        );
      })}

      {editing && (
        <Sheet wide title={editing === 'new' ? 'New campaign' : 'Edit campaign'} onClose={() => setEditing(null)}>
          <Field label="Name"><Input value={draft.name} placeholder="Spring gala 2026"
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} /></Field>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            <Field label="Status">
              <Select value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </Select>
            </Field>
            <Field label="Starts"><Input type="date" value={draft.start_date}
              onChange={e => setDraft(d => ({ ...d, start_date: e.target.value }))} /></Field>
            <Field label="Ends"><Input type="date" value={draft.end_date}
              onChange={e => setDraft(d => ({ ...d, end_date: e.target.value }))} /></Field>
          </div>
          <Field label="Channels"><ChannelPicker value={draft.channels}
            onChange={channels => setDraft(d => ({ ...d, channels }))} /></Field>
          <Field label="Goal — what does success look like?">
            <Input value={draft.objective} placeholder="120 applications from founders in fintech"
              onChange={e => setDraft(d => ({ ...d, objective: e.target.value }))} />
          </Field>
          <Field label="Audience">
            <Input value={draft.audience} placeholder="Founders and senior operators, UK"
              onChange={e => setDraft(d => ({ ...d, audience: e.target.value }))} />
          </Field>
          <Field label="Budget (£, optional)">
            <Input type="number" min="0" step="0.01" value={draft.budget}
              onChange={e => setDraft(d => ({ ...d, budget: e.target.value }))} />
          </Field>
          <Field label="Brief — the plan, in your words">
            <TextArea rows={5} value={draft.brief}
              onChange={e => setDraft(d => ({ ...d, brief: e.target.value }))} />
          </Field>
          {error && <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 12 }}>{error}</div>}
          <Button onClick={save} disabled={busy || !draft.name.trim()}>{busy ? 'Saving…' : 'Save campaign'}</Button>
        </Sheet>
      )}
    </div>
  );
}

/* -------------------------------------------------------------- assets */

const fileLabel = (mime) => {
  if (mime.startsWith('image/')) return null; // thumbnail shows instead
  if (mime.startsWith('video/')) return 'VIDEO';
  if (mime.startsWith('audio/')) return 'AUDIO';
  if (mime === 'application/pdf') return 'PDF';
  if (mime.includes('wordprocessingml')) return 'DOC';
  if (mime.includes('spreadsheetml')) return 'SHEET';
  if (mime.includes('presentationml')) return 'DECK';
  if (mime === 'application/zip') return 'ZIP';
  return 'FILE';
};

function Assets() {
  const [assets, setAssets] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [filter, setFilter] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const load = () => Promise.all([api.marketingAssets(filter || undefined), api.campaigns()])
    .then(([a, c]) => { setAssets(a.assets); setCampaigns(c.campaigns); })
    .catch(e => setError(e.message));
  useEffect(() => { load(); }, [filter]);

  const pick = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setBusy(true);
    try {
      for (const file of files) {
        await api.uploadMarketingAsset(file, { campaign_id: filter || undefined });
      }
      load();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const rename = async (a) => {
    const title = window.prompt('Asset name:', a.title);
    if (title === null || title === a.title) return;
    await api.updateMarketingAsset(a.id, { title }).catch(e => window.alert(e.message));
    load();
  };

  const setCampaign = async (a, campaign_id) => {
    await api.updateMarketingAsset(a.id, { campaign_id: campaign_id || null }).catch(e => window.alert(e.message));
    load();
  };

  const setTags = async (a) => {
    const tags = window.prompt('Tags (comma-separated):', (a.tags || []).join(', '));
    if (tags === null) return;
    await api.updateMarketingAsset(a.id, { tags: tags.split(',').map(s => s.trim()).filter(Boolean) })
      .catch(e => window.alert(e.message));
    load();
  };

  const remove = async (a) => {
    if (!window.confirm(`Delete "${a.title || 'this file'}"? This removes the file itself.`)) return;
    await api.deleteMarketingAsset(a.id).catch(e => window.alert(e.message));
    load();
  };

  if (!assets) return <EmptyState title={error ? 'Could not load assets' : 'Loading…'} hint={error} />;

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}>
          <Select value={filter} onChange={e => setFilter(e.target.value)}>
            <option value="">All assets</option>
            {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
        </div>
        <Button onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : 'Upload files'}
        </Button>
        <input ref={fileRef} type="file" multiple onChange={pick} style={{ display: 'none' }}
          accept="image/*,video/*,audio/*,.pdf,.docx,.xlsx,.pptx,.zip" />
      </div>

      {assets.length === 0 && (
        <EmptyState title="Nothing here yet"
          hint="Photos, video, audio, PDFs, documents and decks all live here — upload anything the team needs to hand." />
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 12 }}>
        {assets.map(a => {
          const url = `${API_BASE}/media/${a.key}`;
          const label = fileLabel(a.mime_type);
          const campaignName = campaigns.find(c => c.id === a.campaign_id)?.name;
          return (
            <Card key={a.id} style={{ padding: 12 }}>
              <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none' }}>
                {label ? (
                  <div style={{
                    height: 110, borderRadius: 12, background: T.ink, display: 'flex',
                    alignItems: 'center', justifyContent: 'center', border: `1px solid ${T.line}`,
                    fontFamily: fontHead, fontWeight: 900, fontSize: 18, color: T.goldSoft, letterSpacing: '0.1em',
                  }}>{label}</div>
                ) : (
                  <img src={url} alt={a.title} loading="lazy" style={{
                    width: '100%', height: 110, objectFit: 'contain', background: T.ink,
                    borderRadius: 12, border: `1px solid ${T.line}`,
                  }} />
                )}
              </a>
              <div onClick={() => rename(a)} title="Rename" style={{
                fontFamily: fontBody, fontWeight: 600, fontSize: 12.5, color: T.cream,
                marginTop: 8, cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{a.title || 'Untitled'}</div>
              <div style={{ fontFamily: fontBody, fontSize: 11, color: T.dim, marginTop: 2 }}>
                {bytes(Number(a.byte_size))} · {a.uploaded_by}
                {campaignName ? ` · ${campaignName}` : ''}
              </div>
              {(a.tags || []).length > 0 && (
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                  {a.tags.map(t => (
                    <span key={t} style={{
                      fontSize: 10, color: T.goldSoft, background: `${T.gold}14`,
                      padding: '2px 7px', borderRadius: 999, fontFamily: fontBody,
                    }}>{t}</span>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 6, marginTop: 9, flexWrap: 'wrap' }}>
                <CopyButton text={url} />
                <Button kind="ghost" style={{ padding: '7px 12px', fontSize: 12 }} onClick={() => setTags(a)}>Tags</Button>
                <select value={a.campaign_id || ''} onChange={e => setCampaign(a, e.target.value)} style={{
                  padding: '7px 8px', borderRadius: 10, border: `1px solid ${T.line}`, background: T.card,
                  color: T.dim, fontSize: 11.5, fontFamily: fontBody, maxWidth: 110,
                }}>
                  <option value="">No campaign</option>
                  {campaigns.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <Button kind="ghost" style={{ padding: '7px 12px', fontSize: 12, color: '#B3261E' }} onClick={() => remove(a)}>Delete</Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- shell */

export default function Marketing() {
  const [tab, setTab] = useState('campaigns');
  return (
    <div>
      <SectionTitle eyebrow="Promotion" title="Marketing" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {[['campaigns', 'Campaigns'], ['assets', 'Asset library']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{
            padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: fontBody,
            fontWeight: 700, fontSize: 13,
            border: `1px solid ${tab === id ? T.gold : T.line}`,
            background: tab === id ? `${T.gold}18` : 'transparent',
            color: tab === id ? T.goldSoft : T.dim,
          }}>{label}</button>
        ))}
      </div>
      {tab === 'campaigns' ? <Campaigns /> : <Assets />}
    </div>
  );
}
