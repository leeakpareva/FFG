/**
 * Connect Concierge.
 *
 * The browser used to call the model provider directly, which meant either
 * shipping a key to every member's device or, as it actually shipped, no key
 * at all and canned replies. Both are wrong. The call lives here instead:
 * the key stays on the server, the system prompt stays on the server, and
 * the client only ever sends conversation turns.
 *
 * Members only, so an unauthenticated caller cannot spend our tokens.
 */
import express from 'express';
import { requireMember } from './auth.js';
import { track } from './track.js';

export const conciergeRouter = express.Router();

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const MAX_TURNS = 20;          // keeps the context, and the bill, bounded
const MAX_CHARS = 4000;        // per message
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `You are the Connect Concierge, the assistant inside the Forbes Family Group member app.

About Forbes Family Group (FFG): a UK organisation opening doors for people from underserved communities across three pillars, Capital, Community and Connect. 10,000+ people supported, 750K+ digital community, £1M+ raised for causes, 16 founders backed, 150+ events hosted. Motto: "From access to ownership."

FFG Digital is the venture arm: it advises and power-teaches early-stage businesses, packages funding with hands-on technology support, and takes a minority stake in startups it powers (Advise, Power, Own). Cohort One applications are open.

Your job: answer member questions warmly and concisely, two to four short sentences. Help them find mentors, events, funding routes and programmes, and take messages for the FFG team. If someone wants to contact the group directly, confirm you have logged their message and that they will hear back within one working day.

Never invent contact details, dates, names or figures. If you do not know something, say so and offer to pass it to the team. Match the tone of a premium members' club: warm, direct, no fluff.`;

conciergeRouter.post('/', requireMember, async (req, res) => {
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'concierge_unconfigured', detail: 'The Concierge is not connected yet.' });
  }

  const incoming = Array.isArray(req.body?.messages) ? req.body.messages : null;
  if (!incoming || incoming.length === 0) {
    return res.status(400).json({ error: 'bad_request', detail: 'messages[] is required.' });
  }

  /* Trust nothing from the client but the words. Roles are whitelisted so a
     caller cannot smuggle in their own system prompt. */
  const turns = incoming
    .slice(-MAX_TURNS)
    .filter(m => m && typeof m.content === 'string' && m.content.trim())
    .map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content.slice(0, MAX_CHARS),
    }));

  if (!turns.length) {
    return res.status(400).json({ error: 'bad_request', detail: 'No usable message content.' });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 500,
        temperature: 0.7,
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...turns],
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => '');
      /* Log the upstream detail server-side. Never hand a provider error back
         to the browser: they can echo request content. */
      console.error('[concierge] upstream %s: %s', upstream.status, detail.slice(0, 500));
      return res.status(502).json({ error: 'upstream_failed', detail: 'The Concierge could not answer just now.' });
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content?.trim();
    if (!reply) {
      return res.status(502).json({ error: 'empty_reply', detail: 'The Concierge could not answer just now.' });
    }
    track(req.member.id, 'concierge_ask', {});
    return res.json({ reply });
  } catch (e) {
    const aborted = e.name === 'AbortError';
    console.error('[concierge] %s', aborted ? 'timeout' : e.message);
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? 'timeout' : 'upstream_failed',
      detail: 'The Concierge could not answer just now.',
    });
  } finally {
    clearTimeout(timer);
  }
});
