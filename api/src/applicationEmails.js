/**
 * The "ready to review" email to Ann, Charlene and Lee.
 *
 * Lives in its own module because two places send it: /apply/complete when
 * Stripe is not configured (review starts immediately), and the Stripe
 * webhook the moment a membership payment hold lands (the normal path —
 * a card hold lapses after ~7 days, so the email says so).
 */
import { q } from './db.js';
import { sendMail, ffgEmail, emailButton, escapeHtml, applyNotify, APP_BASE } from './mailer.js';
import { PLAN_LABELS } from './stripe.js';

export async function sendReviewerAlert(app) {
  const reviewers = applyNotify();
  if (!reviewers.length) return;

  let referrer = app.referred_by || null;
  if (app.referral) {
    const ref = await q('SELECT name FROM members WHERE id = $1', [app.referral]);
    if (ref.rows[0]) referrer = `${ref.rows[0].name} (member link)`;
  }

  const facts = [
    ['Email', app.email],
    ['Phone', app.phone],
    ['Nationality', app.nationality || '—'],
    ['Identifies as', app.identifies_as || '—'],
    ['Describes self as', app.descriptor || '—'],
    ['Industry', app.industry || '—'],
    ['Organisation', app.organisation || '—'],
    ['Role', app.role_title || '—'],
    ['Income bracket', app.income_bracket || '—'],
    ['LinkedIn', app.linkedin_url || '—'],
    ['Instagram', app.instagram_handle ? `@${app.instagram_handle}` : '—'],
    ['Website', app.website_url || '—'],
    ['Heard about us', app.heard_about || '—'],
    ['Referred by', referrer || '—'],
    ['Marketing opt-in', app.marketing_opt_in ? 'Yes' : 'No'],
    ['Membership plan', app.plan ? PLAN_LABELS[app.plan] : '—'],
  ].map(([k, v]) => `
    <tr>
      <td style="padding:6px 14px 6px 0;color:#8A867C;font-size:13px;white-space:nowrap;vertical-align:top;">${k}</td>
      <td style="padding:6px 0;font-size:14px;word-break:break-word;">${escapeHtml(v)}</td>
    </tr>`).join('');

  const answer = (label, value) => value ? `
    <p style="margin:16px 0 4px;color:#8A867C;font-size:13px;">${label}</p>
    <p style="margin:0;white-space:pre-wrap;">${escapeHtml(value)}</p>` : '';

  const held = app.payment_status === 'held';
  sendMail({
    to: reviewers.join(', '),
    cc: 'lee@navada.info',
    subject: `Membership application ready to review: ${app.name}`,
    html: ffgEmail(`
      <p style="margin:0 0 14px;"><strong>${escapeHtml(app.name)}</strong> has completed their
      application for FFG Connect. It is ready for your decision.</p>
      ${held ? `
      <p style="margin:0 0 14px;padding:10px 14px;background:#F7F4EE;border-radius:10px;font-size:13.5px;">
        Their membership fee (${escapeHtml(app.plan ? PLAN_LABELS[app.plan] : '')}) is
        <strong>held on their card, not yet taken</strong>. Approving takes the payment;
        declining releases it. Card holds lapse after about seven days, so please
        decide within the week.
      </p>` : ''}
      <table cellpadding="0" cellspacing="0" style="margin:6px 0 2px;">${facts}</table>
      ${answer('Why they want to join', app.about)}
      ${answer('Their story', app.story)}
      ${answer('What they would bring, and hope to gain', app.contribution)}
      ${answer('What would make membership worth it', app.worth_it)}
      ${emailButton(`${APP_BASE}/admin`, 'Approve or decline')}
      <p style="margin:0;color:#8A867C;font-size:13px;">Approving sets up their membership and
      emails them the welcome and the link to Connect. Declining sends a short, polite note.</p>
    `),
  });
}
