import nodemailer from 'nodemailer';
import { Settings } from '../models/Settings.js';
import { generateNumericCode } from '../utils/security.js';

const SMTP_KEY = 'smtp_platform';
const TEMPLATES_KEY = 'email_templates_platform';

/** @type {null | object} */
let smtpConfig = null;
/** @type {null | Record<string, object>} */
let templatesConfig = null;

const TEMPLATE_META = {
  signup_otp: {
    label: 'Signup / Email verify OTP',
    description: 'Sent when a new trader verifies email during registration.',
    purpose: 'signup'
  },
  login_otp: {
    label: 'Login 2FA OTP',
    description: 'Sent when 2FA is enabled and user signs in.',
    purpose: 'login'
  },
  recovery_otp: {
    label: 'Forgot password OTP',
    description: 'Sent for password reset / recovery.',
    purpose: 'recovery'
  },
  smtp_test: {
    label: 'SMTP test email',
    description: 'Used when admin clicks Send test.',
    purpose: 'test'
  }
};

function defaultShellHtml({ title, bodyHtml }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{{brand}} — ${title}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f14;color:#e8eef4;font-family:Outfit,Segoe UI,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#0b0f14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;background:#12181f;border:1px solid #243040;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 12px 28px;">
              <div style="font-size:20px;font-weight:700;letter-spacing:-0.02em;color:#ffffff;">
                Trad<span style="color:#4cc9c0;">rift</span>
              </div>
              <div style="margin-top:4px;font-size:12px;color:#8b9aab;">Secure account email</div>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 28px 28px 28px;">
              ${bodyHtml}
            </td>
          </tr>
        </table>
        <p style="margin:16px 0 0 0;font-size:11px;color:#64748b;">© {{year}} {{brand}}</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function defaultOtpBody(heading) {
  return `
              <h1 style="margin:0;font-size:22px;line-height:1.3;color:#ffffff;font-weight:650;">${heading}</h1>
              <p style="margin:12px 0 0 0;font-size:14px;line-height:1.6;color:#8b9aab;">
                Hi {{name}},<br /><br />
                Use this one-time password to continue. It expires in
                <strong style="color:#e8eef4;">{{expiresMinutes}} minutes</strong>.
              </p>
              <div style="margin:24px 0;text-align:center;">
                <div style="display:inline-block;padding:14px 22px;border-radius:12px;background:#0b0f14;border:1px solid #243040;color:#4cc9c0;font-size:28px;font-weight:700;font-family:ui-monospace,Menlo,Consolas,monospace;letter-spacing:0.28em;">
                  {{otp}}
                </div>
              </div>
              <p style="margin:0;font-size:13px;line-height:1.6;color:#8b9aab;">
                This email was sent to <strong style="color:#e8eef4;">{{email}}</strong>.
                If you did not request this, ignore this message. Never share your OTP.
              </p>`;
}

function getDefaultTemplates() {
  return {
    signup_otp: {
      key: 'signup_otp',
      enabled: true,
      subject: 'Verify your email — {{brand}} OTP {{otp}}',
      html: defaultShellHtml({
        title: 'Verify email',
        bodyHtml: defaultOtpBody('Verify your email')
      }),
      text: 'Hi {{name}}, your {{brand}} signup OTP is {{otp}}. It expires in {{expiresMinutes}} minutes.'
    },
    login_otp: {
      key: 'login_otp',
      enabled: true,
      subject: 'Your {{brand}} login code: {{otp}}',
      html: defaultShellHtml({
        title: 'Login code',
        bodyHtml: defaultOtpBody('Login verification code')
      }),
      text: 'Hi {{name}}, your {{brand}} login OTP is {{otp}}. Expires in {{expiresMinutes}} minutes.'
    },
    recovery_otp: {
      key: 'recovery_otp',
      enabled: true,
      subject: 'Reset your {{brand}} password — OTP {{otp}}',
      html: defaultShellHtml({
        title: 'Password reset',
        bodyHtml: defaultOtpBody('Password reset code')
      }),
      text: 'Hi {{name}}, your {{brand}} password reset OTP is {{otp}}. Expires in {{expiresMinutes}} minutes.'
    },
    smtp_test: {
      key: 'smtp_test',
      enabled: true,
      subject: '{{brand}} SMTP test OK — sample OTP {{otp}}',
      html: defaultShellHtml({
        title: 'SMTP test',
        bodyHtml: defaultOtpBody('SMTP connection successful')
      }),
      text: '{{brand}} SMTP test OK. Sample OTP: {{otp}}'
    }
  };
}

function purposeToTemplateKey(purpose) {
  const map = {
    signup: 'signup_otp',
    login: 'login_otp',
    recovery: 'recovery_otp',
    verification: 'signup_otp',
    test: 'smtp_test'
  };
  return map[purpose] || 'signup_otp';
}

function defaultFromEnv() {
  const host = String(process.env.SMTP_HOST || '').trim();
  if (!host) return null;
  return {
    enabled: process.env.SMTP_ENABLED !== '0',
    host,
    port: Number(process.env.SMTP_PORT || 587) || 587,
    secure: process.env.SMTP_SECURE === '1' || process.env.SMTP_SECURE === 'true',
    user: String(process.env.SMTP_USER || '').trim(),
    pass: String(process.env.SMTP_PASS || ''),
    fromName: String(process.env.SMTP_FROM_NAME || 'Tradrift').trim() || 'Tradrift',
    fromEmail: String(process.env.SMTP_FROM_EMAIL || process.env.SMTP_USER || '').trim()
  };
}

export function getSmtpSettings() {
  if (smtpConfig) return { ...smtpConfig };
  const fromEnv = defaultFromEnv();
  if (fromEnv) return fromEnv;
  return {
    enabled: false,
    host: '',
    port: 587,
    secure: false,
    user: '',
    pass: '',
    fromName: 'Tradrift',
    fromEmail: ''
  };
}

export function getPublicSmtpSettings() {
  const s = getSmtpSettings();
  const hasPass = Boolean(String(s.pass || '').trim());
  return {
    enabled: !!s.enabled,
    host: s.host || '',
    port: Number(s.port) || 587,
    secure: !!s.secure,
    user: s.user || '',
    fromName: s.fromName || 'Tradrift',
    fromEmail: s.fromEmail || '',
    passSet: hasPass,
    pass: hasPass ? '••••••••••••' : '',
    configured: Boolean(s.host && s.user && hasPass && s.fromEmail)
  };
}

export function setSmtpSettings(partial = {}) {
  const current = getSmtpSettings();
  const next = { ...current };

  if (partial.enabled !== undefined) next.enabled = !!partial.enabled;
  if (partial.host !== undefined) next.host = String(partial.host || '').trim();
  if (partial.port !== undefined) next.port = Number(partial.port) || 587;
  if (partial.secure !== undefined) next.secure = !!partial.secure;
  if (partial.user !== undefined) next.user = String(partial.user || '').trim();
  if (partial.fromName !== undefined) {
    next.fromName = String(partial.fromName || 'Tradrift').trim() || 'Tradrift';
  }
  if (partial.fromEmail !== undefined) next.fromEmail = String(partial.fromEmail || '').trim();

  if (partial.pass !== undefined) {
    const pass = String(partial.pass || '');
    if (pass && !/^•+$/.test(pass) && !pass.includes('••••')) {
      next.pass = pass;
    }
  }

  smtpConfig = next;
  return getSmtpSettings();
}

export async function loadSmtpSettingsFromDb() {
  try {
    const doc = await Settings.findOne({ key: SMTP_KEY });
    if (doc?.value && typeof doc.value === 'object') {
      smtpConfig = {
        enabled: doc.value.enabled !== false,
        host: String(doc.value.host || '').trim(),
        port: Number(doc.value.port) || 587,
        secure: !!doc.value.secure,
        user: String(doc.value.user || '').trim(),
        pass: String(doc.value.pass || ''),
        fromName: String(doc.value.fromName || 'Tradrift').trim() || 'Tradrift',
        fromEmail: String(doc.value.fromEmail || '').trim()
      };
      return getSmtpSettings();
    }
  } catch (err) {
    console.warn('[SMTP] load from DB failed:', err.message || err);
  }
  const fromEnv = defaultFromEnv();
  if (fromEnv) smtpConfig = fromEnv;
  return getSmtpSettings();
}

export async function persistSmtpSettings() {
  const value = getSmtpSettings();
  await Settings.findOneAndUpdate(
    { key: SMTP_KEY },
    { key: SMTP_KEY, value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return value;
}

export function isSmtpReady() {
  const s = getSmtpSettings();
  return !!(s.enabled && s.host && s.user && s.pass && s.fromEmail);
}

function normalizeTemplate(key, raw = {}) {
  const defaults = getDefaultTemplates()[key] || getDefaultTemplates().signup_otp;
  return {
    key,
    enabled: raw.enabled !== false,
    subject: String(raw.subject || defaults.subject),
    html: String(raw.html || defaults.html),
    text: String(raw.text || defaults.text)
  };
}

export function getEmailTemplates() {
  const defaults = getDefaultTemplates();
  const stored = templatesConfig || {};
  const out = {};
  for (const key of Object.keys(defaults)) {
    out[key] = normalizeTemplate(key, stored[key] || defaults[key]);
  }
  return out;
}

export function getEmailTemplatesPublic() {
  const templates = getEmailTemplates();
  return Object.keys(templates).map((key) => ({
    ...templates[key],
    ...(TEMPLATE_META[key] || { label: key, description: '' })
  }));
}

export function setEmailTemplate(key, partial = {}) {
  const allowed = Object.keys(getDefaultTemplates());
  if (!allowed.includes(key)) {
    throw new Error(`Unknown template key: ${key}`);
  }
  const current = getEmailTemplates();
  const nextOne = normalizeTemplate(key, {
    ...current[key],
    ...partial,
    key
  });
  templatesConfig = {
    ...current,
    [key]: nextOne
  };
  return nextOne;
}

export function resetEmailTemplate(key) {
  const defaults = getDefaultTemplates();
  if (!defaults[key]) throw new Error(`Unknown template key: ${key}`);
  const all = getEmailTemplates();
  templatesConfig = {
    ...all,
    [key]: { ...defaults[key] }
  };
  return templatesConfig[key];
}

export async function loadEmailTemplatesFromDb() {
  try {
    const doc = await Settings.findOne({ key: TEMPLATES_KEY });
    if (doc?.value && typeof doc.value === 'object') {
      const defaults = getDefaultTemplates();
      const merged = {};
      for (const key of Object.keys(defaults)) {
        merged[key] = normalizeTemplate(key, doc.value[key] || defaults[key]);
      }
      templatesConfig = merged;
      return getEmailTemplates();
    }
  } catch (err) {
    console.warn('[EmailTemplates] load from DB failed:', err.message || err);
  }
  templatesConfig = getDefaultTemplates();
  return getEmailTemplates();
}

export async function persistEmailTemplates() {
  const value = getEmailTemplates();
  await Settings.findOneAndUpdate(
    { key: TEMPLATES_KEY },
    { key: TEMPLATES_KEY, value, updatedAt: new Date() },
    { upsert: true, new: true }
  );
  return value;
}

export function renderTemplateString(template, vars = {}) {
  return String(template || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
    if (Object.prototype.hasOwnProperty.call(vars, key) && vars[key] != null) {
      return String(vars[key]);
    }
    return '';
  });
}

function buildTemplateVars({
  otp,
  recipientName = '',
  email = '',
  expiresMinutes = 10,
  purpose = ''
}) {
  const smtp = getSmtpSettings();
  const name = String(recipientName || '').trim() || 'there';
  return {
    otp: String(otp || ''),
    name,
    email: String(email || '').trim().toLowerCase(),
    expiresMinutes: String(expiresMinutes),
    purpose: String(purpose || ''),
    brand: smtp.fromName || 'Tradrift',
    year: String(new Date().getFullYear())
  };
}

function createTransport() {
  const s = getSmtpSettings();
  if (!s.host) throw new Error('SMTP host is not configured.');
  return nodemailer.createTransport({
    host: s.host,
    port: Number(s.port) || 587,
    secure: !!s.secure,
    auth: {
      user: s.user,
      pass: s.pass
    }
  });
}

export async function sendMail({ to, subject, html, text }) {
  if (!isSmtpReady()) {
    throw new Error('SMTP is not configured or disabled. Set it up in Admin → Email Templates.');
  }
  const s = getSmtpSettings();
  const transporter = createTransport();
  return transporter.sendMail({
    from: `"${s.fromName}" <${s.fromEmail}>`,
    to,
    subject,
    html,
    text: text || undefined
  });
}

export async function sendTemplatedEmail({
  to,
  templateKey,
  vars = {}
}) {
  const templates = getEmailTemplates();
  const tpl = templates[templateKey];
  if (!tpl) throw new Error(`Email template missing: ${templateKey}`);
  if (tpl.enabled === false) {
    throw new Error(`Email template "${templateKey}" is disabled.`);
  }

  const subject = renderTemplateString(tpl.subject, vars);
  const html = renderTemplateString(tpl.html, vars);
  const text = renderTemplateString(tpl.text, vars);

  await sendMail({ to, subject, html, text });
  return { subject, templateKey };
}

/**
 * Generate random OTP and send via dynamic template.
 */
export async function sendOtpEmail({
  to,
  purpose = 'verification',
  recipientName = '',
  digits = 6,
  expiresMinutes = 10
}) {
  const otp = generateNumericCode(digits);
  const templateKey = purposeToTemplateKey(purpose);
  const vars = buildTemplateVars({
    otp,
    recipientName,
    email: to,
    expiresMinutes,
    purpose
  });

  await sendTemplatedEmail({ to, templateKey, vars });
  return otp;
}

export async function sendTestSmtpEmail(to) {
  const otp = generateNumericCode(6);
  const vars = buildTemplateVars({
    otp,
    recipientName: '',
    email: to,
    expiresMinutes: 10,
    purpose: 'test'
  });
  await sendTemplatedEmail({ to, templateKey: 'smtp_test', vars });
  return { ok: true };
}

/** Keep for any legacy callers / preview */
export function buildOtpEmailHtml(opts) {
  const key = purposeToTemplateKey(opts?.purpose || 'verification');
  const tpl = getEmailTemplates()[key];
  const vars = buildTemplateVars(opts);
  return renderTemplateString(tpl.html, vars);
}

export function shouldExposeOtpInApi() {
  // Never leak OTPs in production — even if AUTH_DEBUG_CODES is mistakenly set.
  if (process.env.NODE_ENV === 'production') return false;
  return process.env.AUTH_DEBUG_CODES === '1';
}

export function getTemplateVariableHelp() {
  return [
    { key: 'otp', label: 'One-time password' },
    { key: 'name', label: 'Recipient name' },
    { key: 'email', label: 'Recipient email' },
    { key: 'expiresMinutes', label: 'OTP expiry minutes' },
    { key: 'brand', label: 'From / brand name' },
    { key: 'year', label: 'Current year' },
    { key: 'purpose', label: 'Purpose key' }
  ];
}
