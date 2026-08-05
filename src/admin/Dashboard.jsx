/**
 * The MI screen. Four questions, four charts, no dual axes:
 * who is using the app, what are they doing, where do they gather,
 * and what has been paid.
 */
import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { T, CHART, Card, StatTile, SectionTitle, EmptyState, gbp, bytes, fontBody } from './ui.jsx';
import { api } from './api.js';

/* Categorical slots are fixed — a type keeps its color whatever else is on
   screen. Anything not listed folds into "other", never a new hue. */
const TYPE_SLOTS = [
  ['room_join', 'Room joins', CHART.cat[0]],
  ['media_upload', 'Uploads', CHART.cat[1]],
  ['article_read', 'Article reads', CHART.cat[2]],
  ['concierge_ask', 'Concierge', CHART.cat[3]],
];

const axisStyle = { fontSize: 11, fontFamily: fontBody, fill: T.dim };
const tipStyle = {
  contentStyle: { background: T.card, border: `1px solid ${T.line}`, borderRadius: 12, fontFamily: fontBody, fontSize: 12 },
  labelStyle: { color: T.cream, fontWeight: 700 },
};

const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const month = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [activity, setActivity] = useState(null);
  const [rooms, setRooms] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [timespent, setTimespent] = useState(null);
  const [engagement, setEngagement] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    Promise.all([
      api.overview(), api.activity(30), api.roomStats(), api.revenue(),
      api.timespent(14), api.engagement(),
    ])
      .then(([o, a, r, v, t, e]) => {
        setOverview(o); setActivity(a); setRooms(r.rooms); setRevenue(v.months);
        setTimespent(t); setEngagement(e);
      })
      .catch(e => setError(e.message));
  }, []);

  if (error) return <EmptyState title="Could not load the dashboard" hint={error} />;
  if (!overview) return <EmptyState title="Loading…" />;

  /* Merge the by-type rows into one object per day for the stacked bars. */
  const byDay = new Map();
  for (const r of activity.by_type) {
    const k = r.day;
    if (!byDay.has(k)) byDay.set(k, { day: day(k) });
    const known = TYPE_SLOTS.find(([t]) => t === r.type);
    const slot = known ? known[0] : 'other';
    byDay.get(k)[slot] = (byDay.get(k)[slot] || 0) + r.n;
  }
  const actionRows = [...byDay.values()];
  const activesRows = activity.actives.map(r => ({ day: day(r.day), members: r.members }));
  const revenueRows = revenue.map(r => ({
    month: month(r.month), paid: r.paid_pence / 100, pending: r.pending_pence / 100,
  }));
  const minutesRows = (timespent?.daily || []).map(r => ({ day: day(r.day), minutes: r.minutes }));
  const soc = engagement?.social || {};

  return (
    <div>
      <SectionTitle eyebrow="MANAGEMENT INFORMATION" title="Dashboard" />

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatTile value={overview.members.n} label={`members · ${overview.members.signed_in} signed in`} />
        <StatTile value={overview.dau} label="active today" accent={T.gold} />
        <StatTile value={overview.wau} label="active this week" />
        <StatTile value={gbp(overview.revenue_pence)} label="revenue collected" accent={T.community} />
        <StatTile value={gbp(overview.pending.pence)} label={`awaiting · ${overview.pending.count} pending`} />
        <StatTile value={bytes(Number(overview.storage.bytes))} label={`storage · ${overview.storage.files} files`} />
      </div>

      {/* the social pulse — how alive the club actually is */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        <StatTile value={soc.posts ?? 0} label="posts" />
        <StatTile value={soc.likes ?? 0} label="likes" />
        <StatTile value={soc.messages ?? 0} label="messages sent" accent={T.connect} />
        <StatTile value={soc.follows ?? 0} label="follows" />
        <StatTile value={soc.rsvps ?? 0} label="event RSVPs" accent={T.community} />
        <StatTile value={`${timespent?.daily?.reduce((n, r) => n + r.minutes, 0) ?? 0}m`} label="time in app · 14 days" accent={T.gold} />
      </div>

      {!overview.integrations.stripe && (
        <Card style={{ marginBottom: 12, borderColor: `${T.gold}66`, background: `${T.gold}0D` }}>
          <span style={{ fontSize: 13, fontFamily: fontBody, color: T.cream }}>
            <strong>Stripe is not connected.</strong> Payments work as a manual ledger until keys are added.
          </span>
        </Card>
      )}
      {overview.integrations.stripe && overview.integrations.stripe_test_mode && (
        <Card style={{ marginBottom: 12, borderColor: `${T.gold}66`, background: `${T.gold}0D` }}>
          <span style={{ fontSize: 13, fontFamily: fontBody, color: T.cream }}>
            <strong>Stripe is in test mode.</strong> Checkout links will not take real money.
          </span>
        </Card>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <Card>
          <ChartTitle>Time in app — minutes per day, last 14 days</ChartTitle>
          {minutesRows.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={minutesRows} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={{ stroke: T.line }} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tipStyle} formatter={(v) => [`${v} min`, 'Time in app']} />
                <Bar dataKey="minutes" name="Minutes" fill={CHART.single} stroke={T.card} strokeWidth={2} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No time recorded yet" hint="Starts filling in as members keep the app open." />}
          {timespent?.top?.length > 0 && (
            <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {timespent.top.slice(0, 5).map(t => (
                <span key={t.member_id} style={{
                  fontSize: 11.5, fontFamily: fontBody, color: T.cream,
                  background: T.ink, border: `1px solid ${T.line}`, borderRadius: 999, padding: '4px 10px',
                }}>{t.name}: <strong>{t.minutes}m</strong></span>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <ChartTitle>Most-read articles</ChartTitle>
          {engagement?.articles?.some(a => a.reads > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={engagement.articles.filter(a => a.reads > 0)} layout="vertical" margin={{ top: 6, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="title" width={150} tick={{ ...axisStyle, fill: T.cream }} tickLine={false} axisLine={false} />
                <Tooltip {...tipStyle} />
                <Bar dataKey="reads" name="Reads" fill={CHART.cat[3]} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No reads yet" hint="Publish articles and this ranks them." />}
        </Card>

        <Card>
          <ChartTitle>Active members — last 30 days</ChartTitle>
          {activesRows.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={activesRows} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={{ stroke: T.line }} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tipStyle} />
                <Line type="monotone" dataKey="members" name="Active members" stroke={CHART.single} strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No activity yet" hint="This fills in as members use the app." />}
        </Card>

        <Card>
          <ChartTitle>What members did</ChartTitle>
          {actionRows.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={actionRows} margin={{ top: 6, right: 10, bottom: 0, left: -22 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="day" tick={axisStyle} tickLine={false} axisLine={{ stroke: T.line }} interval="preserveStartEnd" />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip {...tipStyle} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: fontBody }} />
                {TYPE_SLOTS.map(([key, label, color]) => (
                  /* stroke = 2px surface gap between stacked segments */
                  <Bar key={key} dataKey={key} name={label} stackId="a" fill={color}
                       stroke={T.card} strokeWidth={2} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="Nothing recorded yet" />}
        </Card>

        <Card>
          <ChartTitle>Room joins — last 30 days</ChartTitle>
          {rooms.some(r => r.joins > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={rooms} layout="vertical" margin={{ top: 6, right: 24, bottom: 0, left: 8 }}>
                <CartesianGrid stroke={CHART.grid} horizontal={false} />
                <XAxis type="number" tick={axisStyle} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="title" width={140} tick={{ ...axisStyle, fill: T.cream }} tickLine={false} axisLine={false} />
                <Tooltip {...tipStyle} />
                <Bar dataKey="joins" name="Joins" fill={CHART.cat[2]} radius={[0, 4, 4, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No room joins yet" hint="Counts appear once members join rooms." />}
        </Card>

        <Card>
          <ChartTitle>Revenue by month (£)</ChartTitle>
          {revenueRows.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={revenueRows} margin={{ top: 6, right: 10, bottom: 0, left: -14 }}>
                <CartesianGrid stroke={CHART.grid} vertical={false} />
                <XAxis dataKey="month" tick={axisStyle} tickLine={false} axisLine={{ stroke: T.line }} />
                <YAxis tick={axisStyle} tickLine={false} axisLine={false} />
                <Tooltip {...tipStyle} formatter={(v, n) => ['£' + Number(v).toFixed(2), n]} />
                <Legend wrapperStyle={{ fontSize: 11, fontFamily: fontBody }} />
                <Bar dataKey="paid" name="Collected" fill={CHART.single} stroke={T.card} strokeWidth={2} radius={[3, 3, 0, 0]} />
                <Bar dataKey="pending" name="Awaiting" fill={CHART.neutral} stroke={T.card} strokeWidth={2} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyState title="No payments yet" hint="Create the first one on the Payments screen." />}
        </Card>
      </div>
    </div>
  );
}

const ChartTitle = ({ children }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
    color: T.dim, fontFamily: fontBody, marginBottom: 10,
  }}>{children}</div>
);
