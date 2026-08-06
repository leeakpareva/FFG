/**
 * The public website's CMS. Every editable slot on forbesfamilygroup's
 * front door lives here: text is typed in place, photos go through the
 * same uploader as everything else, and the site reads the result on its
 * next visit — no deploy, no developer.
 *
 * The defaults below mirror lib/content.ts in the website repo. A section
 * saved here overrides the site's built-in copy; "Reset" hands the section
 * back to the built-in.
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  T, Card, SectionTitle, Button, Input, TextArea, Field, EmptyState, fontBody, fontHead,
} from './ui.jsx';
import { api, API_BASE } from './api.js';

const SITE_URL = 'https://forbes-family-group.vercel.app';

/* Mirrors the site's built-in content: what Ann sees before her first edit. */
const DEFAULTS = {
  hero: {
    words: ['Capital.', 'Community.', 'Connect.'],
    sub: 'We remove the barriers we once faced — so the next generation never has to.',
    cta: 'Request an invitation',
    image: '/images/hero-gala.png',
  },
  partners: ['Corten Capital', 'HSBC Innovation Bank', 'Battery Ventures', 'ACLT', 'Mentivity', 'Goals 4 Girls'],
  stats: [
    { value: 10000, suffix: '+', label: 'People supported across the UK' },
    { value: 1.2, prefix: '£', suffix: 'M+', label: 'Raised for charitable causes' },
    { value: 16, label: 'Founders backed and funded' },
    { value: 150, suffix: '+', label: 'Community events hosted' },
  ],
  pillars: [
    { id: 'capital', name: 'Capital', line: 'Money follows belief. We give both.', body: 'Funding, mentorship and the strategic introductions that turn a founder with no access into a business with momentum.', image: '/images/pillar-capital.png', alt: 'Capital', ratio: 'aspect-[16/9]' },
    { id: 'community', name: 'Community', line: 'We show up where it matters.', body: 'Galas that raise millions. Food parcels and uniform drives that reach a single family. Both count. Both last.', image: '/images/pillar-community.png', alt: 'Community', ratio: 'aspect-[4/3]' },
    { id: 'connect', name: 'Connect', line: 'One introduction can change everything.', body: 'An application-only membership of founders and leaders who move with intent — and take each other with them.', image: '/images/pillar-connect.png', alt: 'Connect', ratio: 'aspect-[4/3]' },
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
  moments: [
    { src: '/images/moment-team.png', alt: 'The FFG community', caption: 'The Community', span: 'lg:col-span-7', ratio: 'aspect-[16/10]' },
    { src: '/images/moment-duo.png', alt: 'Gallery evening', caption: 'Gallery Evenings', span: 'lg:col-span-5', ratio: 'aspect-[16/10] lg:aspect-[4/5]' },
    { src: '/images/gala-dinner.png', alt: 'Charity gala', caption: 'ACLT Gala', span: 'lg:col-span-12', ratio: 'aspect-[16/9] lg:aspect-[21/8]' },
  ],
  apply: {
    kicker: 'Connect — application only',
    heading: 'The right room, at the right moment.',
    sub: 'Membership is by application and review. Tell us who you are and where to find you.',
  },
  footer: {
    address: 'c/o HW Fisher LLP, Acre House, 11–15 William Road, London NW1 3ER',
    email: 'hello@forbesfamilygroup.com',
  },
};

/** A photo slot: shows the current image, swaps it via the media uploader. */
const PhotoSlot = ({ value, onChange }) => {
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
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      {src && <img src={src} alt="" style={{ height: 56, width: 84, objectFit: 'cover', borderRadius: 10, border: `1px solid ${T.line}` }} />}
      <Button kind="ghost" onClick={() => fileRef.current?.click()}>{busy ? 'Uploading…' : 'Replace photo'}</Button>
      <input ref={fileRef} type="file" accept="image/*" onChange={pick} style={{ display: 'none' }} />
    </div>
  );
};

/**
 * One editable section: local draft state, Save writes the whole section,
 * Reset returns the site to its built-in copy.
 */
const Section = ({ title, hint, sectionKey, draft, setDraft, overridden, onSaved, children }) => {
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
  return (
    <Card style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 15.5, color: T.cream }}>{title}</span>
        {overridden && (
          <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: T.goldSoft, fontFamily: fontBody }}>EDITED</span>
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

export default function Website() {
  const [saved, setSaved] = useState(null);   // server overrides {key: value}
  const [drafts, setDrafts] = useState(null); // editable copies per section

  const load = () => api.siteContent().then(({ content }) => {
    setSaved(content);
    const merged = {};
    for (const key of Object.keys(DEFAULTS)) {
      merged[key] = structuredClone(content[key] ?? DEFAULTS[key]);
    }
    setDrafts(merged);
  }).catch(() => { setSaved({}); setDrafts(structuredClone(DEFAULTS)); });

  useEffect(() => { load(); }, []);

  if (!drafts) return <EmptyState title="Loading…" />;

  const bind = (key) => (updater) =>
    setDrafts(d => ({ ...d, [key]: typeof updater === 'function' ? updater(d[key]) : updater }));

  const setField = (key, field) => (e) =>
    bind(key)(v => ({ ...v, [field]: e.target.value }));

  const common = (key) => ({
    sectionKey: key,
    draft: drafts[key],
    setDraft: bind(key),
    overridden: saved[key] !== undefined,
    onSaved: load,
  });

  return (
    <div>
      <SectionTitle
        eyebrow="Public website"
        title="Website"
        right={<a href={SITE_URL} target="_blank" rel="noreferrer" style={{ color: T.goldSoft, fontFamily: fontBody, fontSize: 13, fontWeight: 700 }}>View live site ↗</a>}
      />
      <div style={{ fontFamily: fontBody, fontSize: 13, color: T.dim, margin: '0 0 18px', lineHeight: 1.6 }}>
        Edits are live on the website within a minute of saving. Photos accept JPEG or PNG.
      </div>

      <Section title="Hero" hint="The full-screen opening: three headline words, the line beneath, the button, and the background photo." {...common('hero')}>
        <div style={{ display: 'flex', gap: 8 }}>
          {drafts.hero.words.map((w, i) => (
            <Input key={i} value={w} onChange={(e) => bind('hero')(v => {
              const words = [...v.words]; words[i] = e.target.value; return { ...v, words };
            })} />
          ))}
        </div>
        <div style={{ height: 10 }} />
        <Field label="Line beneath"><TextArea rows={2} value={drafts.hero.sub} onChange={setField('hero', 'sub')} /></Field>
        <Field label="Button text"><Input value={drafts.hero.cta} onChange={setField('hero', 'cta')} /></Field>
        <Field label="Background photo"><PhotoSlot value={drafts.hero.image} onChange={(key) => bind('hero')(v => ({ ...v, image: key }))} /></Field>
      </Section>

      <Section title="Partners strip" hint="The scrolling names under the hero. One per line." {...common('partners')}>
        <TextArea
          rows={6}
          value={drafts.partners.join('\n')}
          onChange={(e) => bind('partners')(e.target.value.split('\n').map(s => s.trim()).filter(Boolean))}
        />
      </Section>

      <Section title="Impact numbers" hint="The four counters. Value is the number; prefix/suffix wrap it (£, +, M+)." {...common('stats')}>
        {drafts.stats.map((s, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 64px 64px 1fr', gap: 8, marginBottom: 8 }}>
            <Input type="number" value={s.value} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], value: Number(e.target.value) || 0 }; return stats;
            })} />
            <Input placeholder="£" value={s.prefix || ''} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], prefix: e.target.value || undefined }; return stats;
            })} />
            <Input placeholder="+" value={s.suffix || ''} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], suffix: e.target.value || undefined }; return stats;
            })} />
            <Input value={s.label} onChange={(e) => bind('stats')(v => {
              const stats = [...v]; stats[i] = { ...stats[i], label: e.target.value }; return stats;
            })} />
          </div>
        ))}
      </Section>

      <Section title="Pillars" hint="Capital, Community and Connect: each has a headline, a paragraph and a photo." {...common('pillars')}>
        {drafts.pillars.map((p, i) => (
          <div key={p.id} style={{ borderTop: i ? `1px solid ${T.line}` : 'none', paddingTop: i ? 14 : 0, marginTop: i ? 14 : 0 }}>
            <div style={{ fontFamily: fontBody, fontWeight: 700, fontSize: 12, letterSpacing: '0.12em', color: T.goldSoft, marginBottom: 8 }}>
              {p.name.toUpperCase()}
            </div>
            <Field label="Headline"><Input value={p.line} onChange={(e) => bind('pillars')(v => {
              const ps = [...v]; ps[i] = { ...ps[i], line: e.target.value }; return ps;
            })} /></Field>
            <Field label="Paragraph"><TextArea rows={3} value={p.body} onChange={(e) => bind('pillars')(v => {
              const ps = [...v]; ps[i] = { ...ps[i], body: e.target.value }; return ps;
            })} /></Field>
            <Field label="Photo"><PhotoSlot value={p.image} onChange={(key) => bind('pillars')(v => {
              const ps = [...v]; ps[i] = { ...ps[i], image: key }; return ps;
            })} /></Field>
          </div>
        ))}
      </Section>

      <Section title="Leadership" hint="The photo, the heading, the paragraph and the quote." {...common('leadership')}>
        <Field label="Photo"><PhotoSlot value={drafts.leadership.image} onChange={(key) => bind('leadership')(v => ({ ...v, image: key }))} /></Field>
        <Field label="Photo caption"><Input value={drafts.leadership.imageCaption} onChange={setField('leadership', 'imageCaption')} /></Field>
        <Field label="Heading"><Input value={drafts.leadership.heading} onChange={setField('leadership', 'heading')} /></Field>
        <Field label="Paragraph"><TextArea rows={3} value={drafts.leadership.body} onChange={setField('leadership', 'body')} /></Field>
        <Field label="Quote"><TextArea rows={2} value={drafts.leadership.quote} onChange={setField('leadership', 'quote')} /></Field>
        <Field label="Quote credit"><Input value={drafts.leadership.quoteBy} onChange={setField('leadership', 'quoteBy')} /></Field>
      </Section>

      <Section title="Moments gallery" hint="The three photos near the foot of the page, each with its caption." {...common('moments')}>
        {drafts.moments.map((m, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10, flexWrap: 'wrap' }}>
            <PhotoSlot value={m.src} onChange={(key) => bind('moments')(v => {
              const ms = [...v]; ms[i] = { ...ms[i], src: key }; return ms;
            })} />
            <Input style={{ flex: 1, minWidth: 160 }} value={m.caption} onChange={(e) => bind('moments')(v => {
              const ms = [...v]; ms[i] = { ...ms[i], caption: e.target.value }; return ms;
            })} />
          </div>
        ))}
      </Section>

      <Section title="Application section" hint="The copy around the application form." {...common('apply')}>
        <Field label="Kicker"><Input value={drafts.apply.kicker} onChange={setField('apply', 'kicker')} /></Field>
        <Field label="Heading"><Input value={drafts.apply.heading} onChange={setField('apply', 'heading')} /></Field>
        <Field label="Line beneath"><TextArea rows={2} value={drafts.apply.sub} onChange={setField('apply', 'sub')} /></Field>
      </Section>

      <Section title="Footer" hint="Address and public email." {...common('footer')}>
        <Field label="Address"><Input value={drafts.footer.address} onChange={setField('footer', 'address')} /></Field>
        <Field label="Email"><Input value={drafts.footer.email} onChange={setField('footer', 'email')} /></Field>
      </Section>
    </div>
  );
}
