import axios from 'axios';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { decryptEmail } from './encryption.service.js';

/**
 * Sends an email via Resend HTTP API (https://resend.com).
 * Resend uses port 443 (HTTPS) — never blocked by cloud providers.
 * Nodemailer + Gmail SMTP is NOT used because Render free tier blocks
 * outbound SMTP ports 465 and 587.
 */
/**
 * Sends an email via Brevo (formerly Sendinblue) HTTP API.
 * Brevo free tier: 300 emails/day, send to ANY recipient — no domain needed.
 * Just verify your sender email address in the Brevo dashboard.
 *
 * Resend was replaced because its free tier only allows sending to the
 * account owner's email address (403 for all other recipients).
 */
async function sendViaBrevo({ to, subject, html, text }) {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    logger.warn('[brevo] BREVO_API_KEY not set — email skipped.');
    return { mocked: true };
  }
  const senderEmail = env.systemEmail;
  if (!senderEmail) {
    logger.warn('[brevo] SYSTEM_EMAIL not set — email skipped.');
    return { mocked: true };
  }
  try {
    const { data } = await axios.post(
      'https://api.brevo.com/v3/smtp/email',
      {
        sender: { name: env.emailFromName, email: senderEmail },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
      {
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        timeout: 15_000,
      },
    );
    return data;
  } catch (err) {
    const status = err.response?.status;
    const message = err.response?.data?.message || err.message;
    logger.error(`[brevo] Delivery failed (HTTP ${status ?? 'N/A'}): ${message}`);
    throw Object.assign(new Error('Email delivery failed. Please try again later.'), {
      status: 502,
      isOperational: true,
    });
  }
}


const layout = ({ preheader, title, body, code }) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#eef1f6;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1c1b1f;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef1f6;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr><td style="background:#0061a4;border-radius:24px 24px 0 0;padding:28px 32px;">
          <div style="font-size:20px;font-weight:700;color:#ffffff;letter-spacing:.3px;">CivicFix</div>
          <div style="font-size:13px;color:#d7e6ff;margin-top:4px;">Decentralized civic accountability</div>
        </td></tr>
        <tr><td style="background:#ffffff;border-radius:0 0 24px 24px;padding:32px;">
          <div style="font-size:16px;line-height:1.55;">${body}</div>
          ${
            code
              ? `<div style="margin:24px 0;text-align:center;">
                   <div style="display:inline-block;font-size:34px;font-weight:700;letter-spacing:10px;color:#0061a4;background:#eaf3fb;border-radius:16px;padding:18px 28px;">${code}</div>
                 </div>
                 <div style="font-size:13px;color:#5f6368;">This code expires shortly and can be used only once. If you didn't request it, you can safely ignore this email.</div>`
              : ''
          }
        </td></tr>
        <tr><td style="padding:20px 32px;font-size:12px;color:#8b8f96;text-align:center;">
          &copy; ${new Date().getFullYear()} CivicFix &middot; Civic issue reporting, verified by citizens.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export async function sendEmail({ to, subject, preheader = '', body, code = null }) {
  const html = layout({ preheader, title: subject, body, code });
  const text = body.replace(/<[^>]+>/g, '') + (code ? `\n\nCode: ${code}` : '');

  if (!env.emailEnabled) {
    logger.warn(`[email:disabled] would send "${subject}" to ${to} (code: ${code || 'n/a'})`);
    return { mocked: true };
  }

  const info = await sendViaBrevo({ to, subject, html, text });
  logger.info(`Email sent to ${to} via Brevo`);
  return info;
}

export const sendOtpEmail = (to, purposeLabel, code, extra = '') =>
  sendEmail({
    to,
    subject: `CivicFix — ${purposeLabel}`,
    preheader: `Your CivicFix code is ${code}`,
    body: `Your ${purposeLabel.toLowerCase()} code is below.${extra}`,
    code,
  });

export const sendSuperAdminNotification = (subject, body) =>
  sendEmail({ to: env.superAdminEmail, subject, body });

// ---------------------------------------------------------------------------
// Region & participant email broadcast helpers (features #8 / #9)
// ---------------------------------------------------------------------------

async function emailUsersByQuery(client, queryText, params, subject, body) {
  if (!env.emailEnabled) return;
  const { rows } = await client.query(queryText, params);
  for (const row of rows) {
    const email = decryptEmail(row.email_encrypted);
    if (!email) continue;
    await sendEmail({ to: email, subject, body }).catch((err) =>
      logger.error(`Notification email failed: ${err.message}`),
    );
  }
}

/** Email every citizen registered in a region (new reports, fix requests, etc.). */
export const notifyRegionCitizens = (client, regionId, subject, body) =>
  emailUsersByQuery(
    client,
    `SELECT email_encrypted FROM users
     WHERE region_id = $1 AND role = 'USER' AND email_encrypted IS NOT NULL`,
    [regionId],
    subject,
    body,
  );

/** Email governing admins of a region (super admins always). */
export const notifyRegionAuthorities = (client, regionId, subject, body) =>
  emailUsersByQuery(
    client,
    `SELECT email_encrypted FROM users
     WHERE role IN ('ADMIN', 'SUPER_ADMIN')
       AND (region_id = $1 OR role = 'SUPER_ADMIN')
       AND email_encrypted IS NOT NULL`,
    [regionId],
    subject,
    body,
  );

/** Email a specific set of users (participants on an issue). */
export const notifyUsersByEmail = (client, userIds, subject, body) => {
  if (!userIds || userIds.length === 0) return Promise.resolve();
  return emailUsersByQuery(
    client,
    `SELECT email_encrypted FROM users WHERE id = ANY($1::uuid[]) AND email_encrypted IS NOT NULL`,
    [userIds],
    subject,
    body,
  );
};
