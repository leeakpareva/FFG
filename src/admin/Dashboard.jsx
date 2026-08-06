/**
 * The MI screen. Four questions, no dual axes: who is using the app, what
 * are they doing, where do they gather, and what has been paid.
 *
 * Charts are Chart.js (canvas): gradient fills, rounded bars, dark floating
 * tooltips and eased animations. The palette is the validated CHART set from
 * ui.jsx — slots are fixed, colors never cycle.
 */
import React, { useEffect, useState } from 'react';
import {
  Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement,
  BarElement, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { T, CHART, Card, StatTile, SectionTitle, EmptyState, gbp, bytes, fontBody } from './ui.jsx';
import { api } from './api.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Filler, Tooltip, Legend);

ChartJS.defaults.font.family = "'Inter', sans-serif";
ChartJS.defaults.font.size = 11;
ChartJS.defaults.color = T.dim;
ChartJS.defaults.animation = { duration: 900, easing: 'easeOutQuart' };

/* Categorical slots are fixed — a type keeps its color whatever else is on
   screen. Anything not listed folds into "other", never a new hue. */
const TYPE_SLOTS = [
  ['room_join', 'Room joins', CHART.cat[0]],
  ['media_upload', 'Uploads', CHART.cat[1]],
  ['article_read', 'Article reads', CHART.cat[2]],
  ['concierge_ask', 'Concierge', CHART.cat[3]],
];

/* One tooltip everywhere: dark card floating over the light UI. */
const tooltip = {
  backgroundColor: '#17171B',
  titleColor: '#F7F4EE',
  bodyColor: '#CFCBC2',
  titleFont: { family: "'Inter', sans-serif", weight: 700, size: 12 },
  bodyFont: { family: "'Inter', sans-serif", size: 12 },
  padding: 10,
  cornerRadius: 10,
  displayColors: true,
  boxWidth: 8,
  boxHeight: 8,
  boxPadding: 4,
  usePointStyle: true,
};

const yGrid = { color: CHART.grid, drawTicks: false };
const noGrid = { display: false };
const axisTicks = { maxRotation: 0, autoSkipPadding: 12 };

const baseOptions = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index', intersect: false },
  plugins: { legend: { display: false }, tooltip },
};

/** Vertical gold gradient for area/bar fills, built per-chart-area. */
const goldFill = (alphaTop = 0.55, alphaBottom = 0.04) => (context) => {
  const { ctx, chartArea } = context.chart;
  if (!chartArea) return `rgba(192,133,25,${alphaBottom})`;
  const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
  g.addColorStop(0, `rgba(192,133,25,${alphaTop})`);
  g.addColorStop(1, `rgba(192,133,25,${alphaBottom})`);
  return g;
};

const day = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const month = (d) => new Date(d).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });

const ChartBox = ({ height = 220, children }) => (
  <div style={{ position: 'relative', height }}>{children}</div>
);

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
  const minutesRows = (timespent?.daily || []).map(r => ({ day: day(r.day), minutes: r.minutes }));
  const readArticles = (engagement?.articles || []).filter(a => a.reads > 0);
  const activeRooms = (rooms || []).filter(r => r.joins > 0);
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
            <ChartBox>
              <Bar
                data={{
                  labels: minutesRows.map(r => r.day),
                  datasets: [{
                    label: 'Minutes',
                    data: minutesRows.map(r => r.minutes),
                    backgroundColor: goldFill(0.85, 0.35),
                    hoverBackgroundColor: CHART.single,
                    borderRadius: 7,
                    borderSkipped: false,
                    maxBarThickness: 26,
                  }],
                }}
                options={{
                  ...baseOptions,
                  plugins: { ...baseOptions.plugins, tooltip: { ...tooltip, callbacks: { label: c => ` ${c.parsed.y} min` } } },
                  scales: {
                    x: { grid: noGrid, ticks: axisTicks, border: { color: T.line } },
                    y: { grid: yGrid, border: { display: false }, ticks: { precision: 0 } },
                  },
                }}
              />
            </ChartBox>
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
          {readArticles.length ? (
            <ChartBox>
              <Bar
                data={{
                  labels: readArticles.map(a => a.title),
                  datasets: [{
                    label: 'Reads',
                    data: readArticles.map(a => a.reads),
                    backgroundColor: `${CHART.cat[3]}CC`,
                    hoverBackgroundColor: CHART.cat[3],
                    borderRadius: 7,
                    borderSkipped: false,
                    maxBarThickness: 16,
                  }],
                }}
                options={{
                  ...baseOptions,
                  indexAxis: 'y',
                  interaction: { mode: 'nearest', intersect: false },
                  scales: {
                    x: { grid: yGrid, border: { display: false }, ticks: { precision: 0 } },
                    y: { grid: noGrid, border: { display: false }, ticks: { color: T.cream, callback(v) {
                      const label = this.getLabelForValue(v);
                      return label.length > 24 ? label.slice(0, 23) + '…' : label;
                    } } },
                  },
                }}
              />
            </ChartBox>
          ) : <EmptyState title="No reads yet" hint="Publish articles and this ranks them." />}
        </Card>

        <Card>
          <ChartTitle>Active members — last 30 days</ChartTitle>
          {activesRows.length ? (
            <ChartBox>
              <Line
                data={{
                  labels: activesRows.map(r => r.day),
                  datasets: [{
                    label: 'Active members',
                    data: activesRows.map(r => r.members),
                    borderColor: CHART.single,
                    borderWidth: 2.5,
                    fill: true,
                    backgroundColor: goldFill(0.4, 0.02),
                    tension: 0.35,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: CHART.single,
                    pointHoverBorderColor: '#FFF',
                    pointHoverBorderWidth: 2,
                  }],
                }}
                options={{
                  ...baseOptions,
                  scales: {
                    x: { grid: noGrid, ticks: axisTicks, border: { color: T.line } },
                    y: { grid: yGrid, border: { display: false }, ticks: { precision: 0 } },
                  },
                }}
              />
            </ChartBox>
          ) : <EmptyState title="No activity yet" hint="This fills in as members use the app." />}
        </Card>

        <Card>
          <ChartTitle>What members did</ChartTitle>
          {actionRows.length ? (
            <ChartBox>
              <Bar
                data={{
                  labels: actionRows.map(r => r.day),
                  datasets: TYPE_SLOTS.map(([key, label, color]) => ({
                    label,
                    data: actionRows.map(r => r[key] || 0),
                    backgroundColor: `${color}D9`,
                    hoverBackgroundColor: color,
                    borderRadius: 4,
                    borderSkipped: false,
                    borderColor: T.card,
                    borderWidth: 1,
                    maxBarThickness: 26,
                    stack: 'a',
                  })),
                }}
                options={{
                  ...baseOptions,
                  plugins: {
                    ...baseOptions.plugins,
                    legend: {
                      display: true, position: 'bottom',
                      labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14 },
                    },
                  },
                  scales: {
                    x: { stacked: true, grid: noGrid, ticks: axisTicks, border: { color: T.line } },
                    y: { stacked: true, grid: yGrid, border: { display: false }, ticks: { precision: 0 } },
                  },
                }}
              />
            </ChartBox>
          ) : <EmptyState title="Nothing recorded yet" />}
        </Card>

        <Card>
          <ChartTitle>Room joins — last 30 days</ChartTitle>
          {activeRooms.length ? (
            <ChartBox>
              <Bar
                data={{
                  labels: activeRooms.map(r => r.title),
                  datasets: [{
                    label: 'Joins',
                    data: activeRooms.map(r => r.joins),
                    backgroundColor: `${CHART.cat[2]}CC`,
                    hoverBackgroundColor: CHART.cat[2],
                    borderRadius: 7,
                    borderSkipped: false,
                    maxBarThickness: 16,
                  }],
                }}
                options={{
                  ...baseOptions,
                  indexAxis: 'y',
                  interaction: { mode: 'nearest', intersect: false },
                  scales: {
                    x: { grid: yGrid, border: { display: false }, ticks: { precision: 0 } },
                    y: { grid: noGrid, border: { display: false }, ticks: { color: T.cream, callback(v) {
                      const label = this.getLabelForValue(v);
                      return label.length > 22 ? label.slice(0, 21) + '…' : label;
                    } } },
                  },
                }}
              />
            </ChartBox>
          ) : <EmptyState title="No room joins yet" hint="Counts appear once members join rooms." />}
        </Card>

        <Card>
          <ChartTitle>Revenue by month (£)</ChartTitle>
          {revenue.length ? (
            <ChartBox>
              <Bar
                data={{
                  labels: revenue.map(r => month(r.month)),
                  datasets: [
                    {
                      label: 'Collected',
                      data: revenue.map(r => r.paid_pence / 100),
                      backgroundColor: goldFill(0.9, 0.45),
                      hoverBackgroundColor: CHART.single,
                      borderRadius: 7,
                      borderSkipped: false,
                      maxBarThickness: 30,
                    },
                    {
                      label: 'Awaiting',
                      data: revenue.map(r => r.pending_pence / 100),
                      backgroundColor: `${CHART.neutral}99`,
                      hoverBackgroundColor: CHART.neutral,
                      borderRadius: 7,
                      borderSkipped: false,
                      maxBarThickness: 30,
                    },
                  ],
                }}
                options={{
                  ...baseOptions,
                  plugins: {
                    ...baseOptions.plugins,
                    legend: {
                      display: true, position: 'bottom',
                      labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 7, boxHeight: 7, padding: 14 },
                    },
                    tooltip: { ...tooltip, callbacks: { label: c => ` ${c.dataset.label}: £${Number(c.parsed.y).toFixed(2)}` } },
                  },
                  scales: {
                    x: { grid: noGrid, border: { color: T.line } },
                    y: { grid: yGrid, border: { display: false }, ticks: { callback: v => '£' + v } },
                  },
                }}
              />
            </ChartBox>
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
