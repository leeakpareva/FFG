/**
 * Email, in the FFG brand.
 *
 * Gmail SMTP today (GMAIL_USER + GMAIL_APP_PASSWORD in .env); when the
 * client stands up their own address, the transport swaps in .env with no
 * code change. Every send is fire-and-forget from the caller's point of
 * view: the queue in the database is the source of truth, email is the
 * messenger, and a messenger failing must never block a decision.
 *
 * The logo travels as an inline attachment rather than a hosted image:
 * most mail clients block remote images by default, and a broken box
 * where the mark should be is worse than no mark at all.
 */
import nodemailer from 'nodemailer';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const user = process.env.GMAIL_USER;
const pass = process.env.GMAIL_APP_PASSWORD;
export const mailReady = !!(user && pass);

const transport = mailReady
  ? nodemailer.createTransport({ service: 'gmail', auth: { user, pass } })
  : null;

const LOGO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'ffg-lockup.png');

export const SITE_BASE = (process.env.SITE_BASE || 'https://forbes-family-group.vercel.app').replace(/\/$/, '');
export const APP_BASE = (process.env.APP_BASE || 'https://connect.navada-edge-server.uk').replace(/\/$/, '');
/** Set once Connect is actually in the App Store; until then the web app is the destination. */
export const APP_STORE_URL = process.env.APP_STORE_URL || '';
export const PLAY_STORE_URL = process.env.PLAY_STORE_URL || '';
const CONTACT_EMAIL = process.env.FFG_CONTACT_EMAIL || 'enquiries@forbesfamilygroup.com';
const FFG_ADDRESS = 'Forbes Family Group LTD<br>c/o HW Fisher LLP, Acre House, 11-15 William Road, London NW1 3ER';

/** Comma-separated list of the people who review applications. */
export const applyNotify = () =>
  (process.env.APPLY_NOTIFY || '').split(',').map(s => s.trim()).filter(Boolean);

const gold = '#A8894E', goldSoft = '#8A6F3C', ink = '#17171B', dim = '#8A867C', line = '#E5E1D6';

/**
 * The FFG shell: mark, wordmark rule, content, then the group's footer.
 * `footer: 'full'` adds the address block the client's own emails carry.
 */
export function ffgEmail(bodyHtml, { footer = 'short' } = {}) {
  const foot = footer === 'full'
    ? `
      <div style="padding:22px 32px 26px;border-top:1px solid ${line};font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.7;color:${dim};text-align:center;">
        <div style="font-size:10px;letter-spacing:3px;color:${ink};margin-bottom:10px;">FFG CONNECT</div>
        ${FFG_ADDRESS}<br>
        <a href="mailto:${CONTACT_EMAIL}" style="color:${dim};">${CONTACT_EMAIL}</a><br>
        <span style="display:inline-block;margin-top:8px;">
          <a href="${SITE_BASE}/privacy" style="color:${dim};">Privacy Policy</a>
          &nbsp;&middot;&nbsp;
          <a href="mailto:${CONTACT_EMAIL}?subject=Unsubscribe" style="color:${dim};">Unsubscribe</a>
        </span>
      </div>`
    : `
      <div style="padding:16px 32px;border-top:1px solid ${line};font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${dim};">
        Forbes Family Group &middot; from access to ownership
      </div>`;

  return `
<body style="margin:0;padding:32px 16px;background:#F7F4EE;">
  <div style="max-width:600px;margin:0 auto;background:#FFFFFF;border:1px solid ${line};border-radius:12px;overflow:hidden;">
    <div style="padding:32px 32px 18px;text-align:center;">
      <img src="cid:ffglogo" width="220" alt="Forbes Family Group" style="display:block;margin:0 auto;width:220px;max-width:100%;height:auto;">
      <div style="height:2px;background:linear-gradient(90deg,${gold},${goldSoft});margin-top:22px;"></div>
    </div>
    <div style="padding:8px 32px 28px;font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.65;color:${ink};">
      ${bodyHtml}
    </div>
    ${foot}
  </div>
</body>`;
}

export const emailButton = (href, label) => `
  <p style="margin:24px 0;text-align:center;">
    <a href="${href}" style="display:inline-block;background:${gold};color:#FFFFFF;text-decoration:none;border-radius:999px;padding:14px 32px;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-family:Arial,Helvetica,sans-serif;">${label}</a>
  </p>`;

/** A numbered section heading, matching the form the applicant is filling. */
export const emailStep = (n, title, body) => `
  <table cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 18px;">
    <tr>
      <td style="width:34px;vertical-align:top;">
        <span style="font-family:Georgia,serif;font-size:19px;color:${gold};">${n}</span>
      </td>
      <td style="font-family:Arial,Helvetica,sans-serif;font-size:14.5px;line-height:1.6;color:${ink};">
        <strong>${title}</strong><br>
        <span style="color:${dim};">${body}</span>
      </td>
    </tr>
  </table>`;

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export { esc as escapeHtml };

/** Fire-and-forget send; logs failures, never throws. */
export function sendMail({ to, cc, subject, html }) {
  if (!transport) {
    console.error('[mail] not configured, dropping:', subject);
    return Promise.resolve(false);
  }
  return transport
    .sendMail({
      from: `Forbes Family Group <${user}>`,
      to, cc, subject, html,
      attachments: [{ filename: 'forbes-family-group.png', path: LOGO, cid: 'ffglogo' }],
    })
    .then(() => true)
    .catch((e) => {
      console.error('[mail] send failed (%s): %s', subject, e.message);
      return false;
    });
}
