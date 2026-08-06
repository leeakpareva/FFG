/**
 * The public website's CMS. Every word and every photo on the site is
 * editable here: headings, body copy, buttons, image descriptions, the
 * application section, the footer and the browser/SEO text. Photos go
 * through the same uploader as everything else; the site reads the result
 * on its next visit — no deploy, no developer.
 *
 * The defaults below mirror lib/content.ts in the website repo (keep the
 * two in sync). A section saved here overrides the site's built-in copy;
 * "Reset" hands the section back to the built-in.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  T, Card, SectionTitle, Button, Input, TextArea, Select, Field, EmptyState, fontBody, fontHead,
} from './ui.jsx';
import { api, API_BASE } from './api.js';

const SITE_URL = import.meta.env.VITE_SITE_URL || 'https://forbes-family-group.vercel.app';

/* Mirrors the site's built-in content: what the team sees before the first edit. */
const DEFAULTS = {
  hero: {
    words: ['Capital.', 'Community.', 'Connect.'],
    sub: 'We remove the barriers we once faced — so the next generation never has to.',
    cta: 'Request an invitation',
    secondaryCta: 'Our work',
    image: '/images/hero-gala.png',
    imageAlt: 'Forbes Family Group members together',
  },
  partners: ['Corten Capital', 'HSBC Innovation Bank', 'Battery Ventures', 'ACLT', 'Mentivity', 'Goals 4 Girls'],
  impact: {
    heading: "Change doesn't come from one thing.",
    headingEm: ' It comes from everything connecting.',
  },
  stats: [
    { value: 10000, suffix: '+', label: 'People supported across the UK' },
    { value: 1.2, prefix: '£', suffix: 'M+', label: 'Raised for charitable causes' },
    { value: 16, label: 'Founders backed and funded' },
    { value: 150, suffix: '+', label: 'Community events hosted' },
  ],
  pillars: [
    { id: 'capital', name: 'Capital', line: 'Money follows belief. We give both.', body: 'Funding, mentorship and the strategic introductions that turn a founder with no access into a business with momentum.', image: '/images/pillar-capital.png', alt: 'Founder standing at a boardroom table with the London skyline behind him', ratio: 'aspect-[16/9]' },
    { id: 'community', name: 'Community', line: 'We show up where it matters.', body: 'Galas that raise millions. Food parcels and uniform drives that reach a single family. Both count. Both last.', image: '/images/pillar-community.png', alt: 'A £360,000 cheque presented to the African Caribbean Leukaemia Trust at a gala', ratio: 'aspect-[4/3]' },
    { id: 'connect', name: 'Connect', line: 'One introduction can change everything.', body: 'An application-only membership of founders and leaders who move with intent — and take each other with them.', image: '/images/pillar-connect.png', alt: 'A member in black tie in a grand hotel lobby', ratio: 'aspect-[4/3]' },
  ],
  leadership: {
    image: '/images/leadership.png',
    imageCaption: 'The Forbes Family Group leadership',
    kicker: 'Leadership',
    heading: 'Our roots are in lived experience.',
    body: 'Founded by Dean and Danielle Forbes. Built by people who know exactly what a closed door feels like.',
    quote: "We don't just talk about what's possible. We build it.",
    quoteBy: 'Dean Forbes — No.1, JP Morgan Powerlist 2025',
  },
  moments: {
    heading: 'Rooms where things',
    headingEm: ' actually happen.',
    tag: 'London & beyond',
    items: [
      { src: '/images/moment-team.png', alt: 'The FFG community together at the members space', caption: 'The Community', span: 'lg:col-span-7', ratio: 'aspect-[16/10]' },
      { src: '/images/moment-duo.png', alt: 'Two members in front of a painting at a gallery evening', caption: 'Gallery Evenings', span: 'lg:col-span-5', ratio: 'aspect-[16/10] lg:aspect-[4/5]' },
      { src: '/images/gala-dinner.png', alt: 'Candlelit table at a black-tie charity gala', caption: 'ACLT Gala', span: 'lg:col-span-12', ratio: 'aspect-[16/9] lg:aspect-[21/8]' },
    ],
  },
  apply: {
    kicker: 'FFG Connect',
    kicker2: 'Membership application',
    heading: 'Some rooms you have to apply to be in.',
    sub: "FFG Connect is application-only. We review every application personally, not to create barriers, but to protect the quality of the community you're joining.",
    badges: [
      { top: '~2 minutes', sub: 'to complete' },
      { top: 'Application only', sub: 'no open sign-ups' },
      { top: 'Every application', sub: 'personally reviewed' },
    ],
    successTitle: 'Application received.',
    successBody: "Thank you. Check your email: we've sent you a link to finish the second part of your application, which takes a few more minutes. Nothing goes to our review team until that part is done.",
  },
  footer: {
    address: 'c/o HW Fisher LLP, Acre House, 11–15 William Road, London NW1 3ER',
    email: 'hello@forbesfamilygroup.com',
    tagline: 'Capital · Community · Connect',
  },
  seo: {
    title: 'Forbes Family Group — Capital. Community. Connect.',
    description: 'A not-for-profit social enterprise backing founders, funding communities and making the introductions that change lives.',
  },
};

/* Early saves stored moments as a bare array; fold them into the new shape. */
function normalize(key, value) {
  if (key === 'moments' && Array.isArray(value)) {
    return { ...structuredClone(DEFAULTS.moments), items: value };
  }
  return value;
}

/* Missing fields (added since a section was last saved) fall back to the
   built-in, so an old save never blanks a new slot. Arrays are taken whole. */
function fill(base, over) {
  if (over === undefined || over === null) return structuredClone(base);
  if (Array.isArray(base) || Array.isArray(over)) return structuredClone(over);
  if (typeof base === 'object' && base && typeof over === 'object') {
    const out = {};
    for (const k of new Set([...Object.keys(base), ...Object.keys(over)])) {
      out[k] = fill(base[k], over[k]);
    }
    return out;
  }
  return structuredClone(over);
}

/**
 * A photo slot. The image is shown WHOLE — nothing cut off — on a neutral
 * ground, with a note of the shape the site will crop it to, so the team
 * can see both the photo they chose and how it will sit on the page.
 */
const PhotoSlot = ({ value, onChange, shape }) => {
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const src = !value ? null
    : value.startsWith('http') ? value
    : value.startsWith('/') ? `${SITE_URL}${value}`
    : `${API_BASE}/media/${value}`;
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const { key } = await api.uploadMedia(file);
      onChange(key);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
      {src && (
        <a href={src} target="_blank" rel="noreferrer" title="Open full size">
          <img src={src} alt="" style={{
            height: 84, maxWidth: 170, objectFit: 'contain', display: 'block',
            background: T.ink, borderRadius: 10, border: `1px solid ${T.line}`, padding: 3,
          }} />
        </a>
      )}
      <div>
        <Button kind="ghost" onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Replace photo'}</Button>
        {shape && (
          <div style={{ fontFamily: fontBody, fontSize: 11, color: T.dim, marginTop: 6 }}>
            Shown on the site as {shape}
          </div>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
    </div>
  );
};

/**
 * One editable section: local draft state, Save writes the whole section,
 * Reset returns the site to its built-in copy.
 */
const Section = ({ title, hint, sectionKey, draft, setDraft, overridden, meta, onSaved, children }) => {
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await api.saveSiteContent(sectionKey, draft);
      onSaved();
    } catch (e) {
      window.alert(e.message);
    } finally { setBusy(false); }
  };
  const reset = async () => {
    if (!window.confirm(`Reset "${title}" to the site's built-in content?`)) return;
    setBusy(true);
    try {
      await api.resetSiteContent(sectionKey);
      setDraft(structuredClone(DEFAULTS[sectionKey]));
      onSaved();
    } catch (e) {
      window.alert(e.message);
    } finally { setBusy(false); }
  };
  const edited = overridden && meta ? [
    'EDITED',
    meta.updated_by ? `by ${meta.updated_by}` : null,
    meta.updated_at ? new Date(meta.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : null,
  ].filter(Boolean).join(' · ') : overridden ? 'EDITED' : null;
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 15.5, color: T.cream }}>{title}</span>
        {edited && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: T.goldSoft, fontFamily: fontBody }}>{edited}</span>
        )}
      </div>
      {hint && <div style={{ fontFamily: fontBody, fontSize: 12.5, color: T.dim, marginBottom: 14, lineHeight: 1.5 }}>{hint}</div>}
      {children}
      <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
        <Button onClick={save} disabled={busy}>{busy ? 'Saving…' : 'Save'}</Button>
        {overridden && <Button kind="ghost" onClick={reset} disabled={busy}>Reset to built-in</Button>}
      </div>
    </Card>
  );
};

const RemoveRow = ({ onClick }) => (
  <button type="button" onClick={onClick} title="Remove" style={{
    border: `1px solid ${T.line}`, background: 'transparent', color: T.dim, cursor: 'pointer',
    borderRadius: 10, width: 34, height: 42, fontSize: 16, flexShrink: 0,
  }}>×</button>
);

/* The three layouts a gallery photo can take on the site. */
const MOMENT_LAYOUTS = [
  { id: 'wide', label: 'Wide', span: 'lg:col-span-7', ratio: 'aspect-[16/10]' },
  { id: 'tall', label: 'Tall', span: 'lg:col-span-5', ratio: 'aspect-[16/10] lg:aspect-[4/5]' },
  { id: 'banner', label: 'Full-width banner', span: 'lg:col-span-12', ratio: 'aspect-[16/9] lg:aspect-[21/8]' },
];
const layoutOf = (m) => (MOMENT_LAYOUTS.find(l => l.span === m.span) || MOMENT_LAYOUTS[0]).id;

export default function Website() {
  const [saved, setSaved] = useState(null);   // server overrides {key: value}
  const [meta, setMeta] = useState({});       // {key: {updated_at, updated_by}}
  const [drafts, setDrafts] = useState(null); // editable copies per section
  const [preview, setPreview] = useState(false);
  const [previewNonce, setPreviewNonce] = useState(0); // bump = reload the iframe

  const load = () => api.siteContent().then(({ content, meta }) => {
    setSaved(content);
    setMeta(meta || {});
    const merged = {};
    for (const key of Object.keys(DEFAULTS)) {
      merged[key] = fill(DEFAULTS[key], normalize(key, content[key]));
    }
    setDrafts(merged);
  }).catch(() => { setSaved({}); setDrafts(structuredClone(DEFAULTS)); });

  useEffect(() => { load(); }, []);

  /* After a save the site serves the new content within seconds; the preview
     reloads itself so the editor sees the result without leaving the page. */
  const savedAndRefresh = () => {
    load();
    setTimeout(() => setPreviewNonce(n => n + 1), 1200);
  };

  if (!drafts) return <EmptyState title="Loading…" />;

  const bind = (key) => (updater) =>
    setDrafts(d => ({ ...d, [key]: typeof updater === 'function' ? updater(d[key]) : updater }));

  const setField = (key, field) => (e) =>
    bind(key)(v => ({ ...v, [field]: e.target.value }));

  const setItem = (key, i, field) => (e) =>
    bind(key)(v => {
      const items = [...v];
      items[i] = { ...items[i], [field]: e.target.value };
      return items;
    });

  const common = (key) => ({
    sectionKey: key,
    draft: drafts[key],
    setDraft: bind(key),
    overridden: saved[key] !== undefined,
    meta: meta[key],
    onSaved: savedAndRefresh,
  });

  return (
    <div>
      <SectionTitle
        eyebrow="Public website"
        title="Website"
        right={
          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            <button onClick={() => setPreview(p => !p)} style={{
              border: `1px solid ${preview ? T.gold : T.line}`, borderRadius: 999, cursor: 'pointer',
              background: preview ? `${T.gold}18` : 'transparent', padding: '7px 15px',
              color: preview ? T.goldSoft : T.dim, fontFamily: fontBody, fontSize: 12.5, fontWeight: 700,
            }}>{preview ? 'Hide preview' : 'Show preview'}</button>
            <a href={SITE_URL} target="_blank" rel="noreferrer" style={{ color: T.goldSoft, fontFamily: fontBody, fontSize: 13, fontWeight: 700 }}>View live site ↗</a>
          </div>
        }
      />
      <div style={{ fontFamily: fontBody, fontSize: 13, color: T.dim, margin: '0 0 18px', lineHeight: 1.6 }}>
        Every word and photo below is live on the website within a minute of saving.
        "Photo description" is what screen readers and Google read — a short sentence about what's in the picture.
      </div>

      {preview && (
        <Card style={{ marginBottom: 14, padding: 10, position: 'sticky', top: 8, zIndex: 5 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
            <span style={{ fontFamily: fontBody, fontSize: 11.5, fontWeight: 700, letterSpacing: '0.1em', color: T.dim }}>
              LIVE SITE — reloads itself after every save
            </span>
            <button onClick={() => setPreviewNonce(n => n + 1)} style={{
              border: 'none', background: 'none', cursor: 'pointer', color: T.goldSoft,
              fontFamily: fontBody, fontSize: 12.5, fontWeight: 700,
            }}>Refresh ↻</button>
          </div>
          <iframe
            key={previewNonce}
            src={`${SITE_URL}?admin-preview=${previewNonce}`}
            title="Live site preview"
            style={{
              width: '100%', height: 440, border: `1px solid ${T.line}`, borderRadius: 12,
              background: '#FFF', display: 'block',
            }}
          />
        </Card>
      )}

      <Section title="Hero" hint="The full-screen opening. Each headline line sits on its own row — add or remove lines freely; the last line renders in gold." {...common('hero')}>
        <Field label="Headline (one line per row)">
          <TextArea rows={3} value={drafts.hero.words.join('\n')}
            onChange={(e) => bind('hero')(v => ({ ...v, words: e.target.value.split('\n') }))}
            onBlur={() => bind('hero')(v => ({ ...v, words: v.words.map(w => w.trim()).filter(Boolean) }))} />
        </Field>
        <Field label="Line beneath"><TextArea rows={2} value={drafts.hero.sub} onChange={setField('hero', 'sub')} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Main button"><Input value={drafts.hero.cta} onChange={setField('hero', 'cta')} /></Field>
          <Field label="Second button"><Input value={drafts.hero.secondaryCta} onChange={setField('hero', 'secondaryCta')} /></Field>
        </div>
        <Field label="Background photo"><PhotoSlot shape="a full-screen backdrop" value={drafts.hero.image} onChange={(key) => bind('hero')(v => ({ ...v, image: key }))} /></Field>
        <Field label="Photo description"><Input value={drafts.hero.imageAlt} onChange={setField('hero', 'imageAlt')} /></Field>
      </Section>

      <Section title="Partners strip" hint="The scrolling names under the hero. One per line." {...common('partners')}>
        <TextArea
          rows={6}
          value={drafts.partners.join('\n')}
          onChange={(e) => bind('partners')(e.target.value.split('\n'))}
          onBlur={() => bind('partners')(v => v.map(s => s.trim()).filter(Boolean))}
        />
      </Section>

      <Section title="Impact heading" hint="The heading above the counters. The second part renders in gold." {...common('impact')}>
        <Field label="Heading"><TextArea rows={2} value={drafts.impact.heading} onChange={setField('impact', 'heading')} /></Field>
        <Field label="Gold part"><TextArea rows={2} value={drafts.impact.headingEm} onChange={setField('impact', 'headingEm')} /></Field>
      </Section>

      <Section title="Impact numbers" hint="The counters. Value is the number; prefix/suffix wrap it (£, +, M+)." {...common('stats')}>
        {drafts.stats.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 64px 64px 1fr 34px', gap: 8, marginBottom: 8 }}>
            <Input type="number" value={s.value} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], value: Number(e.target.value) || 0 }; return stats;
            })} />
            <Input placeholder="£" value={s.prefix || ''} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], prefix: e.target.value || undefined }; return stats;
            })} />
            <Input placeholder="+" value={s.suffix || ''} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], suffix: e.target.value || undefined }; return stats;
            })} />
            <Input value={s.label} onChange={setItem('stats', i, 'label')} />
            <RemoveRow onClick={() => bind('stats')(v => v.filter((_, j) => j !== i))} />
          </div>
        ))}
        <Button kind="ghost" onClick={() => bind('stats')(v => [...v, { value: 0, label: '' }])}>Add a number</Button>
      </Section>

      <Section title="Pillars" hint="Capital, Community and Connect: name, headline, paragraph, button and photo for each." {...common('pillars')}>
        {drafts.pillars.map((p, i) => (
          <div key={p.id} style={{ borderTop: i ? `1px solid ${T.line}` : 'none', paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
            <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', color: T.goldSoft, marginBottom: 8 }}>
              {(p.name || '').toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <Field label="Name"><Input value={p.name} onChange={setItem('pillars', i, 'name')} /></Field>
              <Field label="Button text (blank = 'Explore [name]')"><Input value={p.cta || ''} placeholder={`Explore ${p.name}`} onChange={setItem('pillars', i, 'cta')} /></Field>
            </div>
            <Field label="Headline"><Input value={p.line} onChange={setItem('pillars', i, 'line')} /></Field>
            <Field label="Paragraph"><TextArea rows={3} value={p.body} onChange={setItem('pillars', i, 'body')} /></Field>
            <Field label="Photo"><PhotoSlot shape={p.ratio === 'aspect-[16/9]' ? 'a wide 16:9 crop' : 'a 4:3 crop'} value={p.image} onChange={(key) => bind('pillars')(v => {
              const ps = [...v]; ps[i] = { ...ps[i], image: key }; return ps;
            })} /></Field>
            <Field label="Photo description"><Input value={p.alt} onChange={setItem('pillars', i, 'alt')} /></Field>
          </div>
        ))}
      </Section>

      <Section title="Leadership" hint="The portrait, the heading, the paragraph and the quote." {...common('leadership')}>
        <Field label="Kicker (small word above)"><Input value={drafts.leadership.kicker} onChange={setField('leadership', 'kicker')} /></Field>
        <Field label="Photo"><PhotoSlot shape="a tall 4:5 portrait crop" value={drafts.leadership.image} onChange={(key) => bind('leadership')(v => ({ ...v, image: key }))} /></Field>
        <Field label="Photo caption"><Input value={drafts.leadership.imageCaption} onChange={setField('leadership', 'imageCaption')} /></Field>
        <Field label="Heading"><Input value={drafts.leadership.heading} onChange={setField('leadership', 'heading')} /></Field>
        <Field label="Paragraph"><TextArea rows={3} value={drafts.leadership.body} onChange={setField('leadership', 'body')} /></Field>
        <Field label="Quote"><TextArea rows={2} value={drafts.leadership.quote} onChange={setField('leadership', 'quote')} /></Field>
        <Field label="Quote credit"><Input value={drafts.leadership.quoteBy} onChange={setField('leadership', 'quoteBy')} /></Field>
      </Section>

      <Section title="Moments gallery" hint="The photo mosaic near the foot of the page. Add or remove photos; each has a caption, a description and a layout." {...common('moments')}>
        <Field label="Heading"><Input value={drafts.moments.heading} onChange={setField('moments', 'heading')} /></Field>
        <Field label="Gold part"><Input value={drafts.moments.headingEm} onChange={setField('moments', 'headingEm')} /></Field>
        <Field label="Small tag (top right)"><Input value={drafts.moments.tag} onChange={setField('moments', 'tag')} /></Field>
        {drafts.moments.items.map((m, i) => (
          <div key={i} style={{ borderTop: `1px solid ${T.line}`, paddingTop: 12, marginTop: 12 }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <PhotoSlot value={m.src} onChange={(key) => bind('moments')(v => {
                const items = [...v.items]; items[i] = { ...items[i], src: key }; return { ...v, items };
              })} />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Input placeholder="Caption" value={m.caption} onChange={(e) => bind('moments')(v => {
                    const items = [...v.items]; items[i] = { ...items[i], caption: e.target.value }; return { ...v, items };
                  })} />
                  <Select value={layoutOf(m)} style={{ width: 170 }} onChange={(e) => bind('moments')(v => {
                    const l = MOMENT_LAYOUTS.find(x => x.id === e.target.value) || MOMENT_LAYOUTS[0];
                    const items = [...v.items]; items[i] = { ...items[i], span: l.span, ratio: l.ratio }; return { ...v, items };
                  })}>
                    {MOMENT_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.label}</option>)}
                  </Select>
                  <RemoveRow onClick={() => bind('moments')(v => ({ ...v, items: v.items.filter((_, j) => j !== i) }))} />
                </div>
                <div style={{ height: 8 }} />
                <Input placeholder="Photo description (for screen readers)" value={m.alt} onChange={(e) => bind('moments')(v => {
                  const items = [...v.items]; items[i] = { ...items[i], alt: e.target.value }; return { ...v, items };
                })} />
              </div>
            </div>
          </div>
        ))}
        <div style={{ marginTop: 12 }}>
          <Button kind="ghost" onClick={() => bind('moments')(v => ({
            ...v, items: [...v.items, { src: '', alt: '', caption: '', span: 'lg:col-span-7', ratio: 'aspect-[16/10]' }],
          }))}>Add a photo</Button>
        </div>
      </Section>

      <Section title="Application section" hint="Everything around the application form: the copy above it, the three reassurance cards, and the thank-you message." {...common('apply')}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Field label="Kicker"><Input value={drafts.apply.kicker} onChange={setField('apply', 'kicker')} /></Field>
          <Field label="Second kicker"><Input value={drafts.apply.kicker2} onChange={setField('apply', 'kicker2')} /></Field>
        </div>
        <Field label="Heading"><TextArea rows={2} value={drafts.apply.heading} onChange={setField('apply', 'heading')} /></Field>
        <Field label="Paragraph beneath"><TextArea rows={3} value={drafts.apply.sub} onChange={setField('apply', 'sub')} /></Field>
        <Field label="Reassurance cards">
          {drafts.apply.badges.map((b, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
              <Input placeholder="Top line" value={b.top} onChange={(e) => bind('apply')(v => {
                const badges = [...v.badges]; badges[i] = { ...badges[i], top: e.target.value }; return { ...v, badges };
              })} />
              <Input placeholder="Small line" value={b.sub} onChange={(e) => bind('apply')(v => {
                const badges = [...v.badges]; badges[i] = { ...badges[i], sub: e.target.value }; return { ...v, badges };
              })} />
            </div>
          ))}
        </Field>
        <Field label="Thank-you heading"><Input value={drafts.apply.successTitle} onChange={setField('apply', 'successTitle')} /></Field>
        <Field label="Thank-you message"><TextArea rows={3} value={drafts.apply.successBody} onChange={setField('apply', 'successBody')} /></Field>
      </Section>

      <Section title="Footer" hint="Address, public email and the strapline." {...common('footer')}>
        <Field label="Address"><Input value={drafts.footer.address} onChange={setField('footer', 'address')} /></Field>
        <Field label="Email"><Input value={drafts.footer.email} onChange={setField('footer', 'email')} /></Field>
        <Field label="Strapline"><Input value={drafts.footer.tagline} onChange={setField('footer', 'tagline')} /></Field>
      </Section>

      <Section title="Browser & search text" hint="The page title in the browser tab and the description Google and social shares show." {...common('seo')}>
        <Field label="Page title"><Input value={drafts.seo.title} onChange={setField('seo', 'title')} /></Field>
        <Field label="Description"><TextArea rows={2} value={drafts.seo.description} onChange={setField('seo', 'description')} /></Field>
      </Section>
    </div>
  );
}
