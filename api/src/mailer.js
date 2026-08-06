/**
 * Email, in the FFG design language.
 *
 * Gmail SMTP today (GMAIL_USER + GMAIL_APP_PASSWORD in .env); when the
 * client stands up their own address, the transport swaps in .env with no
 * code change. Every send is fire-and-forget from the caller's point of
 * view: the queue in the database is the source of truth, email is the
 * messenger, and a messenger failing must never block a decision.
 */
import nodemailer from 'nodemailer';

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
export const mailReady = !!(user && pass);

const transport = mailReady
  ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  : null;

export const SITE_BASE = process.env.SITE_BASE || 'https://forbes-family-group.vercel.app';
export const APP_BASE = process.env.APP_BASE || 'https://connect.navada-edge-server.uk';

/** Comma-separated list of the people who review applications. */
export const applyNotify = () =>
  (process.env.APPLY_NOTIFY || '').split(',').map(s => s.trim()).filter(Boolean);

const gold = '#A8894E', ink = '#17171B', dim = '#8A867C', line = '#E5E1D6';

/** FFG-themed shell: paper page, white card, gold rule under the wordmark. */
export function ffgEmail(bodyHtml) {
  return `
<body style="margin:0;padding:32px 16px;background:#F7F4EE;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid ${line};border-radius:12px;overflow:hidden;">
    <div style="padding:28px 32px 20px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-weight:700;font-size:24px;color:${ink};">Forbes Family Group</div>
      <div style="font-family:Arial,Helvetica,sans-serif;font-size:10px;letter-spacing:3px;color:${dim};margin-top:3px;">CAPITAL &middot; COMMUNITY &middot; CONNECT</div>
      <div style="height:2px;background:linear-gradient(90deg,${gold},#8A6F3C);margin-top:16px;"></div>
    </div>
    <div style="padding:4px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:${ink};">
      ${bodyHtml}
    </div>
    <div style="padding:16px 32px;border-top:1px solid ${line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${dim};">
      Forbes Family Group &middot; from access to ownership
    </div>
  </div>
</body>`;
}

export const emailButton = (href, label) => `
  <p style="margin:22px 0;">
    <a href="${href}" style="display:inline-block;background:${gold};color:#FFFFFF;text-decoration:none;border-radius:999px;padding:13px 28px;font-size:12px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${label}</a>
  </p>`;

const esc = (s) => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { esc as escapeHtml };

/** Fire-and-forget send; logs failures, never throws. */
export function sendMail({ to, cc, subject, html }) {
  if (!transport) {
    console.error('[mail] not configured, dropping:', subject);
    return Promise.resolve(false);
  }
  return transport
    .sendMail({ from: `Forbes Family Group <${user}>`, to, cc, subject, html })
    .then(() => true)
    .catch((e) => {
      console.error('[mail] send failed (%s): %s', subject, e.message);
      return false;
    });
}
