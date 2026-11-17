/**
 * Provider-agnostic Email & OTP service (Adapter / Strategy).
 *
 * Application code should only call the public helpers below.
 * Swap EMAIL_PROVIDER (and related env vars) to change the transport —
 * no call-site changes required.
 *
 * Supported providers:
 * - smtp      → SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS
 * - rest_api  → EMAIL_API_URL / EMAIL_API_KEY
 */

import 'dotenv/config';
import nodemailer from 'nodemailer';

const PROVIDERS = {
  SMTP: 'smtp',
  REST_API: 'rest_api'
};

function getConfig() {
  const provider = String(process.env.EMAIL_PROVIDER || PROVIDERS.SMTP)
    .trim()
    .toLowerCase();

  const fromAddress = String(
    process.env.EMAIL_FROM_ADDRESS || process.env.SMTP_FROM_EMAIL || ''
  ).trim();
  const fromName = String(
    process.env.EMAIL_FROM_NAME || process.env.SMTP_FROM_NAME || 'Tradrift'
  ).trim() || 'Tradrift';

  return {
    provider,
    apiUrl: String(process.env.EMAIL_API_URL || '').trim(),
    apiKey: String(process.env.EMAIL_API_KEY || '').trim(),
    fromAddress,
    fromName,
    smtp: {
      host: String(process.env.SMTP_HOST || '').trim(),
      port: Number(process.env.SMTP_PORT || 465) || 465,
      secure:
        process.env.SMTP_SECURE === '1' ||
        process.env.SMTP_SECURE === 'true' ||
        Number(process.env.SMTP_PORT || 465) === 465,
      user: String(process.env.SMTP_USER || '').trim(),
      pass: String(process.env.SMTP_PASS || '')
    }
  };
}

function assertRestApiConfig(config) {
  if (!config.apiUrl) {
    throw new Error('EMAIL_API_URL is not configured.');
  }
  if (!config.apiKey) {
    throw new Error('EMAIL_API_KEY is not configured.');
  }
  if (!config.fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS is not configured.');
  }
}

/**
 * Provider-specific payload formatting (REST API).
 * Isolated so other providers can add their own builders later.
 * @private
 */
function buildRestApiPayload({ toEmail, toName, subject, htmlBody }, config) {
  return {
    from: {
      address: config.fromAddress,
      name: config.fromName
    },
    to: [
      {
        email_address: {
          address: toEmail,
          name: toName || ''
        }
      }
    ],
    subject,
    htmlbody: htmlBody
  };
}

/**
 * @private
 */
async function sendViaRestApi({ toEmail, toName, subject, htmlBody }, config) {
  assertRestApiConfig(config);

  const payload = buildRestApiPayload(
    { toEmail, toName, subject, htmlBody },
    config
  );

  const response = await fetch(config.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiKey
    },
    body: JSON.stringify(payload)
  });

  const rawText = await response.text();
  let data = null;
  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = { raw: rawText };
  }

  if (!response.ok) {
    const detail =
      (data && (data.message || data.error || data.status)) ||
      rawText ||
      response.statusText;
    throw new Error(`Email API request failed (${response.status}): ${detail}`);
  }

  return {
    ok: true,
    provider: PROVIDERS.REST_API,
    status: response.status,
    data
  };
}

function assertSmtpConfig(config) {
  if (!config.smtp.host) throw new Error('SMTP_HOST is not configured.');
  if (!config.smtp.user) throw new Error('SMTP_USER is not configured.');
  if (!config.smtp.pass) throw new Error('SMTP_PASS is not configured.');
  if (!config.fromAddress) {
    throw new Error('EMAIL_FROM_ADDRESS (or SMTP_FROM_EMAIL) is not configured.');
  }
}

/**
 * Provider-specific send via SMTP (nodemailer).
 * @private
 */
async function sendViaSmtp({ toEmail, toName, subject, htmlBody }, config) {
  assertSmtpConfig(config);

  const transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: !!config.smtp.secure,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass
    }
  });

  const to = toName ? `"${toName}" <${toEmail}>` : toEmail;
  const info = await transporter.sendMail({
    from: `"${config.fromName}" <${config.fromAddress}>`,
    to,
    subject,
    html: htmlBody
  });

  return {
    ok: true,
    provider: PROVIDERS.SMTP,
    messageId: info.messageId,
    response: info.response,
    data: info
  };
}

/**
 * Resolve the active transport strategy from EMAIL_PROVIDER.
 * @private
 */
function getProviderStrategy(config = getConfig()) {
  switch (config.provider) {
    case PROVIDERS.SMTP:
      return {
        name: PROVIDERS.SMTP,
        send: (message) => sendViaSmtp(message, config)
      };
    case PROVIDERS.REST_API:
      return {
        name: PROVIDERS.REST_API,
        send: (message) => sendViaRestApi(message, config)
      };
    default:
      throw new Error(
        `Unsupported EMAIL_PROVIDER "${config.provider}". Supported: ${Object.values(PROVIDERS).join(', ')}`
      );
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildOtpHtml({ toName, otpCode, brand }) {
  const safeName = String(toName || '').trim() || 'there';
  const code = String(otpCode || '').trim();
  const brandName = String(brand || 'Tradrift').trim() || 'Tradrift';
  const year = new Date().getFullYear();

  // Plain, table-based HTML — avoids spam triggers (no scripts, tracking pixels, or heavy CSS).
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${brandName} verification code</title>
</head>
<body style="margin:0;padding:0;background:#f4f6f8;color:#1a1a1a;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#ffffff;border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:24px 28px 8px 28px;font-size:18px;font-weight:bold;color:#111827;">
              ${brandName}
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              <p style="margin:0 0 12px 0;font-size:15px;line-height:1.5;color:#374151;">
                Hi ${safeName},
              </p>
              <p style="margin:0 0 16px 0;font-size:15px;line-height:1.5;color:#374151;">
                Your one-time verification code is:
              </p>
              <p style="margin:0 0 16px 0;font-size:28px;letter-spacing:6px;font-weight:bold;color:#111827;font-family:Courier New,Courier,monospace;">
                ${code}
              </p>
              <p style="margin:0 0 12px 0;font-size:14px;line-height:1.5;color:#4b5563;">
                This code expires shortly. Do not share it with anyone.
              </p>
              <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280;">
                If you did not request this code, you can safely ignore this email.
              </p>
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:12px;color:#9ca3af;">
          &copy; ${year} ${brandName}
        </p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Send a single email via the configured provider.
 */
export async function sendEmail({ toEmail, toName = '', subject, htmlBody }) {
  const email = String(toEmail || '').trim().toLowerCase();
  if (!email) throw new Error('toEmail is required.');
  if (!subject) throw new Error('subject is required.');
  if (!htmlBody) throw new Error('htmlBody is required.');

  const strategy = getProviderStrategy();
  return strategy.send({
    toEmail: email,
    toName: String(toName || '').trim(),
    subject: String(subject),
    htmlBody: String(htmlBody)
  });
}

/**
 * Send an OTP email with a spam-safe HTML template.
 */
export async function sendOTP({ toEmail, toName = '', otpCode }) {
  const code = String(otpCode || '').trim();
  if (!code) throw new Error('otpCode is required.');

  const config = getConfig();
  const brand = config.fromName;
  const subject = `${brand} verification code: ${code}`;
  const htmlBody = buildOtpHtml({ toName, otpCode: code, brand });

  return sendEmail({ toEmail, toName, subject, htmlBody });
}

/**
 * Send the same message to many recipients in paced batches
 * to reduce rate-limit failures at high daily volume.
 */
export async function sendBulkEmails({
  recipients,
  subject,
  htmlBody,
  batchSize = 10,
  delayMs = 1000
}) {
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error('recipients must be a non-empty array.');
  }
  if (!subject) throw new Error('subject is required.');
  if (!htmlBody) throw new Error('htmlBody is required.');

  const size = Math.max(1, Number(batchSize) || 10);
  const pause = Math.max(0, Number(delayMs) || 0);

  const results = [];
  const errors = [];

  for (let i = 0; i < recipients.length; i += size) {
    const batch = recipients.slice(i, i + size);

    const settled = await Promise.allSettled(
      batch.map((recipient) => {
        const toEmail =
          typeof recipient === 'string' ? recipient : recipient?.toEmail || recipient?.email;
        const toName =
          typeof recipient === 'string' ? '' : recipient?.toName || recipient?.name || '';

        return sendEmail({ toEmail, toName, subject, htmlBody }).then((result) => ({
          toEmail: String(toEmail || '').trim().toLowerCase(),
          result
        }));
      })
    );

    for (const item of settled) {
      if (item.status === 'fulfilled') {
        results.push(item.value);
      } else {
        errors.push({
          error: item.reason?.message || String(item.reason)
        });
      }
    }

    const hasMore = i + size < recipients.length;
    if (hasMore && pause > 0) {
      await sleep(pause);
    }
  }

  return {
    ok: errors.length === 0,
    sent: results.length,
    failed: errors.length,
    results,
    errors
  };
}

export default {
  sendEmail,
  sendOTP,
  sendBulkEmails
};
