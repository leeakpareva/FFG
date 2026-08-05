/**
 * Usage tracking — the feed behind the admin dashboard's charts.
 *
 * Fire-and-forget by design: analytics must never slow down or break the
 * request it is riding on, so nothing here is awaited by callers and every
 * failure ends at a log line.
 */
import { q } from './db.js';

export function track(memberId, type, meta = {}) {
  q(
    `INSERT INTO usage_events (member_id, type, meta) VALUES ($1, $2, $3)`,
    [memberId || null, type, JSON.stringify(meta)]
  ).catch((e) => console.error('[track] %s failed: %s', type, e.message));
}

/**
 * "Active" is special: it fires on every profile fetch, which happens on
 * every app open and would flood the table. One row per member per hour is
 * enough to draw a daily-actives chart.
 */
/**
 * Presence pings measure time actually spent in the app: the client sends
 * one a minute while the tab is visible, we keep at most one a minute, and
 * "minutes in app" is then simply a count of rows. Cheap, honest, and it
 * degrades to nothing when the app is closed.
 */
export function trackPing(memberId) {
  q(
    `INSERT INTO usage_events (member_id, type)
     SELECT $1, 'ping'
      WHERE NOT EXISTS (
        SELECT 1 FROM usage_events
         WHERE member_id = $1 AND type = 'ping'
           AND created_at > now() - interval '55 seconds')`,
    [memberId]
  ).catch((e) => console.error('[track] ping failed: %s', e.message));
}

export function trackActive(memberId) {
  q(
    `INSERT INTO usage_events (member_id, type)
     SELECT $1, 'active'
      WHERE NOT EXISTS (
        SELECT 1 FROM usage_events
         WHERE member_id = $1 AND type = 'active'
           AND created_at > now() - interval '1 hour')`,
    [memberId]
  ).catch((e) => console.error('[track] active failed: %s', e.message));
}
