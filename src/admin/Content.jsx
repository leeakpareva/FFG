/**
 * Everything members read and watch, in four shelves. Creating something
 * here is what makes it exist in the app — drafts stay invisible to
 * members until published.
 *
 * Video goes browser → Cloudflare Stream directly; this screen only asks
 * the API for the one-time upload URL and then reports progress.
 */
import React, { useEffect, useState, useRef } from 'react';
import {
  T, Card, SectionTitle, Button, Input, TextArea, Select, Field, Sheet,
  EmptyState, PillarTag, fontBody, fontHead,
} from './ui.jsx';
import { api } from './api.js';

const SHELVES = ['Articles', 'Events', 'Replays', 'Workshops'];

export default function Content() {
  const [shelf, setShelf] = useState('Articles');
  return (
    <div>
      <SectionTitle eyebrow="LIBRARY & EVENTS" title="Content" />
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {SHELVES.map(s => (
          <button key={s} onClick={() => setShelf(s)} style={{
            padding: '9px 18px', borderRadius: 999, cursor: 'pointer', fontFamily: fontBody,
            fontWeight: 700, fontSize: 13,
            border: `1px solid ${shelf === s ? T.gold : T.line}`,
            background: shelf === s ? `${T.gold}14` : 'transparent',
            color: shelf === s ? T.goldSoft : T.dim,
          }}>{s}</button>
        ))}
      </div>
      {shelf === 'Articles' && <Articles />}
      {shelf === 'Events' && <Events />}
      {shelf === 'Replays' && <Replays />}
      {shelf === 'Workshops' && <Workshops />}
    </div>
  );
}

/* ---------------------------------------------------------------- shared */

const Row = ({ children, first }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
    borderTop: first ? 'none' : `1px solid ${T.line}`, flexWrap: 'wrap',
  }}>{children}</div>
);

const RowTitle = ({ title, sub }) => (
  <div style={{ flex: 1, minWidth: 0, flexBasis: '55%' }}>
    <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 14.5, color: T.cream }}>{title}</div>
    {sub && <div style={{ fontSize: 12, color: T.dim, fontFamily: fontBody, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
  </div>
);

const DraftTag = ({ draft }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase',
    color: draft ? T.dim : T.community, background: `${draft ? T.dim : T.community}16`,
    padding: '3px 9px', borderRadius: 999, fontFamily: fontBody,
  }}>{draft ? 'draft' : 'live'}</span>
);

const ErrorLine = ({ text }) => (
  <div style={{ fontSize: 13, color: '#B3261E', fontFamily: fontBody, marginBottom: 12 }}>{text}</div>
);

/** Cover image picker: uploads through the admin media endpoint. */
const CoverField = ({ imageKey, onKey }) => {
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { key } = await api.uploadMedia(file);
      onKey(key);
    } catch { /* the field simply stays empty */ }
    setBusy(false);
  };
  return (
    <Field label="Cover image (optional)">
      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
        <Button kind="ghost" type="button" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? 'Uploading…' : imageKey ? 'Replace image' : 'Choose image'}
        </Button>
        {imageKey && <img src={`/media/${imageKey}`} alt="" style={{ height: 44, borderRadius: 8 }} />}
        <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
      </div>
    </Field>
  );
};

/* -------------------------------------------------------------- articles */

function Articles() {
  const [rows, setRows] = useState(null);
  const [composing, setComposing] = useState(false);
  const load = () => api.articles().then(({ articles }) => setRows(articles)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <EmptyState title="Loading…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}><Button onClick={() => setComposing(true)}>Write an article</Button></div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((a, i) => (
          <Row key={a.id} first={!i}>
            <RowTitle title={a.title} sub={`${a.reads} reads · ${a.read_time || ''}`} />
            <PillarTag name={a.tag} />
            <DraftTag draft={a.is_draft} />
            <Button kind="ghost" style={{ padding: '8px 14px' }}
                    onClick={() => api.setArticleDraft(a.id, !a.is_draft).then(load)}>
              {a.is_draft ? 'Publish' : 'Unpublish'}
            </Button>
            <Button kind="ghost" style={{ padding: '8px 14px', color: '#B3261E' }}
                    onClick={() => window.confirm(`Delete "${a.title}"?`) && api.deleteArticle(a.id).then(load)}>
              Delete
            </Button>
          </Row>
        ))}
        {!rows.length && <EmptyState title="No articles yet" hint="Write the first one — it appears on the Read shelf." />}
      </Card>
      {composing && <ArticleSheet onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
    </>
  );
}

const ArticleSheet = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ title: '', excerpt: '', tag: 'Community', read_time: '4 min', body: '', image_key: null });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async (draft) => {
    setBusy(true); setError(null);
    try {
      let media_id = null;
      await api.createArticle({
        title: form.title, excerpt: form.excerpt, tag: form.tag, read_time: form.read_time,
        media_id,
        body: form.body.split(/\n\s*\n/).map(s => s.trim()).filter(Boolean),
        is_draft: draft,
      });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title="New article" onClose={onClose} wide>
      <Field label="Title"><Input value={form.title} onChange={put('title')} autoFocus /></Field>
      <Field label="Excerpt — the line shown on the shelf"><Input value={form.excerpt} onChange={put('excerpt')} /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Pillar">
            <Select value={form.tag} onChange={put('tag')}>
              <option>Capital</option><option>Community</option><option>Connect</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Read time"><Input value={form.read_time} onChange={put('read_time')} /></Field>
        </div>
      </div>
      <Field label="Body — blank line between paragraphs">
        <TextArea value={form.body} onChange={put('body')} style={{ minHeight: 200 }} />
      </Field>
      {error && <ErrorLine text={error} />}
      <div style={{ display: 'flex', gap: 10 }}>
        <Button onClick={() => submit(false)} disabled={busy || !form.title || !form.body.trim()} style={{ flex: 1 }}>
          {busy ? 'Working…' : 'Publish now'}
        </Button>
        <Button kind="ghost" onClick={() => submit(true)} disabled={busy || !form.title || !form.body.trim()}>
          Save as draft
        </Button>
      </div>
    </Sheet>
  );
};

/* ---------------------------------------------------------------- events */

function Events() {
  const [rows, setRows] = useState(null);
  const [composing, setComposing] = useState(false);
  const load = () => api.events().then(({ events }) => setRows(events)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <EmptyState title="Loading…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}><Button onClick={() => setComposing(true)}>Create an event</Button></div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((e, i) => (
          <Row key={e.id} first={!i}>
            <div style={{
              width: 46, textAlign: 'center', fontFamily: fontHead, color: T.cream,
              background: T.ink, borderRadius: 10, padding: '6px 0', border: `1px solid ${T.line}`,
            }}>
              <div style={{ fontWeight: 900, fontSize: 17 }}>{e.day}</div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.1em', color: T.dim }}>{e.month}</div>
            </div>
            <RowTitle title={e.name} sub={`${e.venue}${e.time_label ? ' · ' + e.time_label : ''}${e.price_pence ? ` · £${(e.price_pence / 100).toFixed(2)}` : ' · free'}`} />
            <PillarTag name={e.tag} />
            <Button kind="ghost" style={{ padding: '8px 14px', color: '#B3261E' }}
                    onClick={() => window.confirm(`Delete "${e.name}"?`) && api.deleteEvent(e.id).then(load)}>
              Delete
            </Button>
          </Row>
        ))}
        {!rows.length && <EmptyState title="No events yet" hint="Events appear on the members' Events tab." />}
      </Card>
      {composing && <EventSheet onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
    </>
  );
}

const EventSheet = ({ onClose, onDone }) => {
  const [form, setForm] = useState({
    name: '', venue: '', day: '', month: '', time_label: '', tag: 'Community',
    spots: '', about: '', image_key: null, price: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true); setError(null);
    /* Blank price = free event. A price routes members through Stripe. */
    const pounds = parseFloat(form.price);
    const price_pence = Number.isFinite(pounds) && pounds > 0 ? Math.round(pounds * 100) : null;
    try { await api.createEvent({ ...form, price_pence }); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };

  return (
    <Sheet title="New event" onClose={onClose} wide>
      <Field label="Name"><Input value={form.name} onChange={put('name')} autoFocus /></Field>
      <Field label="Venue"><Input value={form.venue} onChange={put('venue')} placeholder="Shoreditch, London" /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Day"><Input value={form.day} onChange={put('day')} placeholder="31" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Month"><Input value={form.month} onChange={put('month')} placeholder="JUL" /></Field></div>
        <div style={{ flex: 2 }}><Field label="Time"><Input value={form.time_label} onChange={put('time_label')} placeholder="8:00 – 10:00 AM" /></Field></div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Pillar">
            <Select value={form.tag} onChange={put('tag')}>
              <option>Capital</option><option>Community</option><option>Connect</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}><Field label="Spots"><Input value={form.spots} onChange={put('spots')} placeholder="8 seats left" /></Field></div>
        <div style={{ flex: 1 }}><Field label="Ticket price £ (blank = free)"><Input value={form.price} onChange={put('price')} placeholder="25.00" /></Field></div>
      </div>
      <Field label="About"><TextArea value={form.about} onChange={put('about')} /></Field>
      <CoverField imageKey={form.image_key} onKey={key => setForm(f => ({ ...f, image_key: key }))} />
      {error && <ErrorLine text={error} />}
      <Button onClick={submit} disabled={busy || !form.name || !form.venue || !form.day || !form.month} style={{ width: '100%' }}>
        {busy ? 'Creating…' : 'Create event'}
      </Button>
    </Sheet>
  );
};

/* --------------------------------------------------------------- replays */

function Replays() {
  const [rows, setRows] = useState(null);
  const [composing, setComposing] = useState(false);
  const [uploading, setUploading] = useState(null); // replay being given video
  const load = () => api.replays().then(({ replays }) => setRows(replays)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <EmptyState title="Loading…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}><Button onClick={() => setComposing(true)}>Add a replay</Button></div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((r, i) => (
          <Row key={r.id} first={!i}>
            <RowTitle title={r.title} sub={r.stream_uid ? 'video attached' : 'no video yet'} />
            <PillarTag name={r.tag} />
            <DraftTag draft={!r.published} />
            <Button kind="ghost" style={{ padding: '8px 14px' }} onClick={() => setUploading(r)}>
              {r.stream_uid ? 'Video…' : 'Upload video'}
            </Button>
            <Button kind="ghost" style={{ padding: '8px 14px' }}
                    onClick={() => api.setReplayPublished(r.id, !r.published).then(load)}>
              {r.published ? 'Unpublish' : 'Publish'}
            </Button>
            <Button kind="ghost" style={{ padding: '8px 14px', color: '#B3261E' }}
                    onClick={() => window.confirm(`Delete "${r.title}" and its video?`) && api.deleteReplay(r.id).then(load)}>
              Delete
            </Button>
          </Row>
        ))}
        {!rows.length && <EmptyState title="No replays yet" hint="Replays appear on the members' Watch shelf." />}
      </Card>
      {composing && <ReplaySheet onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
      {uploading && <VideoSheet replay={uploading} onClose={() => { setUploading(null); load(); }} />}
    </>
  );
}

const ReplaySheet = ({ onClose, onDone }) => {
  const [form, setForm] = useState({ title: '', summary: '', tag: 'Community', duration: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true); setError(null);
    try { await api.createReplay(form); onDone(); }
    catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Sheet title="New replay" onClose={onClose}>
      <Field label="Title"><Input value={form.title} onChange={put('title')} autoFocus /></Field>
      <Field label="Summary"><TextArea value={form.summary} onChange={put('summary')} /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Pillar">
            <Select value={form.tag} onChange={put('tag')}>
              <option>Capital</option><option>Community</option><option>Connect</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}><Field label="Duration"><Input value={form.duration} onChange={put('duration')} placeholder="48 min" /></Field></div>
      </div>
      {error && <ErrorLine text={error} />}
      <Button onClick={submit} disabled={busy || !form.title} style={{ width: '100%' }}>
        {busy ? 'Creating…' : 'Create — then upload the video'}
      </Button>
    </Sheet>
  );
};

/**
 * The upload itself. The file goes straight to Cloudflare; progress comes
 * from XHR because fetch still cannot report upload progress.
 */
const VideoSheet = ({ replay, onClose }) => {
  const [state, setState] = useState({ phase: 'idle', pct: 0, detail: null });
  const fileRef = useRef(null);

  useEffect(() => {
    if (replay.stream_uid) {
      api.replayVideoStatus(replay.id)
        .then(s => setState({ phase: 'attached', pct: 100, detail: s }))
        .catch(() => {});
    }
  }, [replay]);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setState({ phase: 'preparing', pct: 0 });
      const { uploadURL } = await api.replayUploadUrl(replay.id);
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', uploadURL);
        const form = new FormData();
        form.append('file', file);
        xhr.upload.onprogress = (ev) =>
          ev.lengthComputable && setState({ phase: 'uploading', pct: Math.round((ev.loaded / ev.total) * 100) });
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`upload failed (${xhr.status})`)));
        xhr.onerror = () => reject(new Error('upload failed'));
        xhr.send(form);
      });
      setState({ phase: 'processing', pct: 100 });
    } catch (err) {
      setState({ phase: 'error', pct: 0, detail: err.message });
    }
  };

  return (
    <Sheet title={`Video — ${replay.title}`} onClose={onClose}>
      {state.phase === 'attached' && state.detail && (
        <div style={{ fontSize: 13.5, fontFamily: fontBody, color: T.cream, marginBottom: 16, lineHeight: 1.6 }}>
          A video is attached · state: <strong>{state.detail.state}</strong>
          {state.detail.ready && ' — ready to stream'}
        </div>
      )}
      {(state.phase === 'idle' || state.phase === 'attached' || state.phase === 'error') && (
        <>
          {state.phase === 'error' && <ErrorLine text={state.detail} />}
          <Button onClick={() => fileRef.current?.click()} style={{ width: '100%' }}>
            {replay.stream_uid ? 'Replace video' : 'Choose video file'}
          </Button>
          <input ref={fileRef} type="file" accept="video/*" onChange={pick} style={{ display: 'none' }} />
        </>
      )}
      {(state.phase === 'preparing' || state.phase === 'uploading') && (
        <div>
          <div style={{ height: 8, borderRadius: 4, background: T.line, overflow: 'hidden', marginBottom: 10 }}>
            <div style={{ height: '100%', width: `${state.pct}%`, background: T.gold, transition: 'width .3s' }} />
          </div>
          <div style={{ fontSize: 13, color: T.dim, fontFamily: fontBody, textAlign: 'center' }}>
            {state.phase === 'preparing' ? 'Preparing…' : `Uploading — ${state.pct}%`}
          </div>
        </div>
      )}
      {state.phase === 'processing' && (
        <div style={{ fontSize: 13.5, color: T.cream, fontFamily: fontBody, lineHeight: 1.6 }}>
          Uploaded. Cloudflare is processing it — it becomes playable in the
          app automatically, usually within a couple of minutes.
        </div>
      )}
    </Sheet>
  );
};

/* ------------------------------------------------------------- workshops */

function Workshops() {
  const [rows, setRows] = useState(null);
  const [composing, setComposing] = useState(false);
  const load = () => api.workshops().then(({ workshops }) => setRows(workshops)).catch(() => setRows([]));
  useEffect(() => { load(); }, []);
  if (!rows) return <EmptyState title="Loading…" />;

  return (
    <>
      <div style={{ marginBottom: 12 }}><Button onClick={() => setComposing(true)}>Create a workshop</Button></div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((w, i) => (
          <Row key={w.id} first={!i}>
            <RowTitle title={w.title} sub={`${w.level} · ${w.seats_taken}/${w.seats_total} seats${w.when_label ? ' · ' + w.when_label : ''}`} />
            <PillarTag name={w.tag} />
            {w.is_live && <span style={{ fontSize: 10, fontWeight: 700, color: '#D7263D', fontFamily: fontBody }}>● LIVE</span>}
            <DraftTag draft={!w.published} />
            <Button kind="ghost" style={{ padding: '8px 14px' }}
                    onClick={() => api.updateWorkshop(w.id, { is_live: !w.is_live }).then(load)}>
              {w.is_live ? 'End live' : 'Go live'}
            </Button>
            <Button kind="ghost" style={{ padding: '8px 14px' }}
                    onClick={() => api.updateWorkshop(w.id, { published: !w.published }).then(load)}>
              {w.published ? 'Unpublish' : 'Publish'}
            </Button>
            <Button kind="ghost" style={{ padding: '8px 14px', color: '#B3261E' }}
                    onClick={() => window.confirm(`Delete "${w.title}"?`) && api.deleteWorkshop(w.id).then(load)}>
              Delete
            </Button>
          </Row>
        ))}
        {!rows.length && <EmptyState title="No workshops yet" hint="Workshops appear on the members' Learn shelf." />}
      </Card>
      {composing && <WorkshopSheet onClose={() => setComposing(false)} onDone={() => { setComposing(false); load(); }} />}
    </>
  );
}

const WorkshopSheet = ({ onClose, onDone }) => {
  const [form, setForm] = useState({
    title: '', blurb: '', tag: 'Community', level: 'Beginner', duration: '90 min',
    sessions: 1, seats_total: 20, when_label: '', outcomes: '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const put = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true); setError(null);
    try {
      await api.createWorkshop({
        ...form,
        sessions: parseInt(form.sessions, 10) || 1,
        seats_total: parseInt(form.seats_total, 10) || 20,
        outcomes: form.outcomes.split('\n').map(s => s.trim()).filter(Boolean),
      });
      onDone();
    } catch (e) { setError(e.message); setBusy(false); }
  };
  return (
    <Sheet title="New workshop" onClose={onClose} wide>
      <Field label="Title"><Input value={form.title} onChange={put('title')} autoFocus /></Field>
      <Field label="Blurb"><TextArea value={form.blurb} onChange={put('blurb')} /></Field>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}>
          <Field label="Pillar">
            <Select value={form.tag} onChange={put('tag')}>
              <option>Capital</option><option>Community</option><option>Connect</option>
            </Select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="Level">
            <Select value={form.level} onChange={put('level')}>
              <option>Beginner</option><option>Intermediate</option><option>Advanced</option>
            </Select>
          </Field>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <div style={{ flex: 1 }}><Field label="Duration"><Input value={form.duration} onChange={put('duration')} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Sessions"><Input type="number" value={form.sessions} onChange={put('sessions')} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Seats"><Input type="number" value={form.seats_total} onChange={put('seats_total')} /></Field></div>
      </div>
      <Field label="When — as members should read it"><Input value={form.when_label} onChange={put('when_label')} placeholder="Tue 12 Aug · 6pm" /></Field>
      <Field label="Outcomes — one per line"><TextArea value={form.outcomes} onChange={put('outcomes')} /></Field>
      {error && <ErrorLine text={error} />}
      <Button onClick={submit} disabled={busy || !form.title} style={{ width: '100%' }}>
        {busy ? 'Creating…' : 'Create workshop'}
      </Button>
    </Sheet>
  );
};
