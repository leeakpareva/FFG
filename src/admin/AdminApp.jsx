/**
 * The shell: login gate, then a left rail (desktop) or bottom bar (phone)
 * around the four screens. Same shape as the member app's chrome, so moving
 * between the two feels like one product.
 */
import React, { useEffect, useState } from 'react';
import { T, AgentMark, fontHead, fontBody } from './ui.jsx';
import { getToken, clearToken, whoAmI } from './api.js';
import Login from './Login.jsx';
import Dashboard from './Dashboard.jsx';
import Members from './Members.jsx';
import Content from './Content.jsx';
import Payments from './Payments.jsx';
import Applications from './Applications.jsx';
import Website from './Website.jsx';
import Marketing from './Marketing.jsx';
import Team from './Team.jsx';

/* scope: which team-account scope opens the screen; null = superadmin only.
   The API enforces the same map server-side — this only shapes the nav. */
const SCREENS = [
  { id: 'dashboard', label: 'Dashboard', C: Dashboard, scope: null },
  { id: 'applications', label: 'Applications', C: Applications, scope: 'applications' },
  { id: 'members', label: 'Members', C: Members, scope: null },
  { id: 'content', label: 'Content', C: Content, scope: null },
  { id: 'website', label: 'Website', C: Website, scope: 'website' },
  { id: 'marketing', label: 'Marketing', C: Marketing, scope: 'marketing' },
  { id: 'payments', label: 'Payments', C: Payments, scope: null },
  { id: 'team', label: 'Team', C: Team, scope: null },
];

export default function AdminApp() {
  const [authed, setAuthed] = useState(() => !!getToken());
  const [screen, setScreen] = useState(null);
  const [wide, setWide] = useState(() => window.innerWidth >= 900);

  useEffect(() => {
    const onResize = () => setWide(window.innerWidth >= 900);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  if (!authed) return <Login onIn={() => setAuthed(true)} />;

  const me = whoAmI();
  const allowed = (s) => me?.role === 'superadmin' || (s.scope && me?.scopes.includes(s.scope));
  const visible = SCREENS.filter(allowed);
  const active = visible.find(s => s.id === screen) || visible[0] || SCREENS[0];
  const Active = active.C;

  const NavButton = ({ s, horizontal }) => (
    <button onClick={() => setScreen(s.id)} style={{
      display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer',
      border: 'none', borderRadius: 12, textAlign: 'left',
      padding: horizontal ? '9px 6px' : '11px 14px',
      flexDirection: horizontal ? 'column' : 'row',
      flex: horizontal ? 1 : 'none', width: horizontal ? 'auto' : '100%',
      background: active.id === s.id ? `${T.gold}14` : 'transparent',
      color: active.id === s.id ? T.goldSoft : T.dim,
      fontFamily: fontBody, fontWeight: 700, fontSize: horizontal ? 10.5 : 13.5,
    }}>
      {s.label}
    </button>
  );

  return (
    <div style={{ minHeight: '100dvh', background: T.ink, display: 'flex' }}>
      {wide && (
        <div style={{
          width: 216, flexShrink: 0, borderRight: `1px solid ${T.line}`,
          padding: '26px 14px', display: 'flex', flexDirection: 'column', gap: 4,
          position: 'sticky', top: 0, height: '100dvh', boxSizing: 'border-box',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 10px', marginBottom: 26 }}>
            <AgentMark size={24} />
            <div>
              <div style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 16, color: T.cream, letterSpacing: '0.02em' }}>Connect</div>
              <div style={{ fontSize: 9.5, letterSpacing: '0.22em', color: T.gold, fontWeight: 700, fontFamily: fontBody }}>ADMIN</div>
            </div>
          </div>
          {visible.map(s => <NavButton key={s.id} s={s} />)}
          <div style={{ flex: 1 }} />
          {me && (
            <div style={{ padding: '0 14px 10px', fontFamily: fontBody, fontSize: 11.5, color: T.dim }}>
              Signed in as <span style={{ color: T.cream, fontWeight: 700 }}>{me.name}</span>
            </div>
          )}
          <button onClick={() => { clearToken(); setScreen(null); window.location.reload(); }} style={{
            border: `1px solid ${T.line}`, background: 'transparent', color: T.dim, cursor: 'pointer',
            borderRadius: 12, padding: '10px 14px', fontFamily: fontBody, fontWeight: 600, fontSize: 12.5,
          }}>Sign out</button>
          <a href="https://navada-lab.space/" target="_blank" rel="noreferrer" style={{
            display: 'block', textAlign: 'center', marginTop: 10, fontFamily: fontBody,
            fontSize: 10, letterSpacing: '0.12em', color: T.dim, textDecoration: 'none',
          }}>Powered by NAVADA</a>
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0 }}>
        {!wide && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 18px', borderBottom: `1px solid ${T.line}`, background: T.ink,
            position: 'sticky', top: 0, zIndex: 10,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <AgentMark size={20} />
              <span style={{ fontFamily: fontHead, fontWeight: 900, fontSize: 15, color: T.cream }}>
                Connect <span style={{ color: T.gold, fontSize: 10, letterSpacing: '0.18em' }}>ADMIN</span>
              </span>
            </div>
            <button onClick={() => { clearToken(); window.location.reload(); }} style={{
              border: 'none', background: 'none', color: T.dim, cursor: 'pointer',
              fontFamily: fontBody, fontWeight: 600, fontSize: 12.5,
            }}>Sign out</button>
          </div>
        )}

        <div style={{ padding: wide ? '10px 30px 40px' : '4px 16px 90px', maxWidth: 1060, margin: '0 auto' }}>
          <Active />
        </div>

        {!wide && (
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, display: 'flex',
            background: T.ink2, borderTop: `1px solid ${T.line}`, padding: '6px 8px calc(6px + env(safe-area-inset-bottom))',
          }}>
            {visible.map(s => <NavButton key={s.id} s={s} horizontal />)}
          </div>
        )}
      </div>
    </div>
  );
}
