/**
 * Embeddings — the ML behind suggestions and the ranked feed.
 *
 * Every member and post gets a 1536-dim vector from OpenAI
 * (text-embedding-3-small, which matches the vector(1536) columns the
 * schema shipped with). Similarity between those vectors is what "posts
 * you'll care about" and "people you should meet" actually mean here —
 * the same retrieval idea Instagram-style feeds are built on, at a scale
 * a members' club needs.
 *
 * Everything is fire-and-forget: ranking degrades to recency when a vector
 * is missing, so embedding failures can never break posting or sign-in.
 */
import { q } from './db.js';

const KEY = process.env.OPENAI_API_KEY;
export const embedReady = !!KEY;

const MODEL = 'text-embedding-3-small';

export async function embedText(text) {
  if (!KEY) return null;
  const input = String(text || '').trim().slice(0, 6000);
  if (!input) return null;
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, input }),
  });
  if (!res.ok) throw new Error(`embeddings ${res.status}`);
  const data = await res.json();
  return data.data?.[0]?.embedding || null;
}

/** pgvector literal: '[0.1,0.2,...]' */
const literal = (vec) => `[${vec.join(',')}]`;

/** A member's vector comes from who they say they are. */
export function embedMember(member) {
  if (!KEY) return;
  const text = [member.name, member.role, member.pillar, member.bio].filter(Boolean).join('. ');
  embedText(text)
    .then(vec => vec && q('UPDATE members SET embedding = $2 WHERE id = $1', [member.id, literal(vec)]))
    .catch(e => console.error('[embed] member %s: %s', member.id, e.message));
}

export function embedPost(postId, body) {
  if (!KEY) return;
  embedText(body)
    .then(vec => vec && q('UPDATE posts SET embedding = $2 WHERE id = $1', [postId, literal(vec)]))
    .catch(e => console.error('[embed] post %s: %s', postId, e.message));
}

/** Backfill everything missing a vector. Called from the admin panel. */
export async function reindexAll() {
  if (!KEY) return { embedded: 0, detail: 'no OPENAI_API_KEY' };
  let embedded = 0;

  const members = await q(`SELECT id, name, role, pillar, bio FROM members WHERE embedding IS NULL`);
  for (const m of members.rows) {
    const vec = await embedText([m.name, m.role, m.pillar, m.bio].filter(Boolean).join('. '));
    if (vec) { await q('UPDATE members SET embedding = $2 WHERE id = $1', [m.id, literal(vec)]); embedded++; }
  }

  const posts = await q(`SELECT id, body FROM posts WHERE embedding IS NULL`);
  for (const p of posts.rows) {
    const vec = await embedText(p.body);
    if (vec) { await q('UPDATE posts SET embedding = $2 WHERE id = $1', [p.id, literal(vec)]); embedded++; }
  }

  return { embedded };
}
