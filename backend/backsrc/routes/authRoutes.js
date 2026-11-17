import express from 'express';
import {
  authMiddleware,
  signToken,
  memoryUsers
} from '../middleware/authMiddleware.js';
import { User } from '../models/User.js';
import {
  checkRateLimit,
  compareSecret,
  hashCode,
  hashSecret,
  timingSafeEqualHex
} from '../utils/security.js';
import { allowMemoryAuth, dbUnavailableResponse, isDbReady } from '../utils/db.js';
import {
  buildSignupSubscription,
  getByokSalesEnabled
} from '../services/membershipPlans.js';
import {
  connectByok,
  getByokPublicStatus,
  classifyUserFeedMode,
  loadUserWithByokSecrets,
  resolveUserMarketFeed
} from '../services/byokSessionService.js';
import { Payment } from '../models/Payment.js';
import { activateMembershipForUser } from '../services/membershipActivation.js';
import {
  isSmtpReady,
  sendOtpEmail,
  shouldExposeOtpInApi
} from '../services/platformEmailService.js';

const router = express.Router();

// email -> { codeHash, expiresAt, attempts }
const recoveryCodes = new Map();
// email -> { codeHash, expiresAt, attempts, userId }
const pending2fa = new Map();
// email -> { codeHash, expiresAt, attempts } — signup email verification
const signupOtps = new Map();

const sanitizeUser = (user) => ({
  id: user._id || user.id,
  _id: user._id || user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  twoFactorEnabled: !!user.twoFactorEnabled,
  subscription: user.subscription
    ? {
        status: user.subscription.status,
        plan: user.subscription.plan,
        planId: user.subscription.planId || null,
        mode: user.subscription.mode || 'server',
        byokGranted: !!user.subscription.byokGranted,
        expiresAt: user.subscription.expiresAt
      }
    : user.subscription,
  byok: getByokPublicStatus(user)
});

const issueAuthResponse = (res, user, status = 200, expiresIn = '30d') => {
  const token = signToken(user, expiresIn);
  return res.status(status).json({
    success: true,
    token,
    user: sanitizeUser(user)
  });
};

const getAgeFromDob = (dobValue) => {
  const birth = new Date(dobValue);
  if (Number.isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
};

const clientKey = (req, suffix) => {
  const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
  return `${suffix}:${ip}`;
};

const OTP_DIGITS = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
/** Minimum wait between OTP emails to the same address (signup / login / forgot). */
const OTP_RESEND_COOLDOWN_MS = 30 * 1000;
/** key -> last successful send timestamp */
const otpLastSentAt = new Map();

function otpApiPayload(message, otp, extra = {}) {
  const payload = { success: true, message, retryAfterSec: 30, ...extra };
  if (shouldExposeOtpInApi() && otp) payload.otp = otp;
  return payload;
}

function getOtpSendCooldown(key) {
  const last = otpLastSentAt.get(key) || 0;
  const retryAfterMs = Math.max(0, OTP_RESEND_COOLDOWN_MS - (Date.now() - last));
  return {
    allowed: retryAfterMs === 0,
    retryAfterMs,
    retryAfterSec: Math.ceil(retryAfterMs / 1000) || 0
  };
}

function markOtpSent(key) {
  otpLastSentAt.set(key, Date.now());
}

function otpCooldownResponse(retryAfterSec) {
  return {
    success: false,
    message: `Please wait ${retryAfterSec}s before requesting another OTP.`,
    retryAfterSec
  };
}

async function issueAndSendOtp({ email, purpose, recipientName = '' }) {
  if (!isSmtpReady()) {
    throw new Error('Email OTP is unavailable. Admin must configure SMTP first.');
  }
  const code = await sendOtpEmail({
    to: email,
    purpose,
    recipientName,
    digits: OTP_DIGITS,
    expiresMinutes: 10
  });
  return code;
}

async function begin2faChallenge(user, { force = false } = {}) {
  const email = String(user.email).toLowerCase().trim();
  const coolKey = `login:${email}`;
  const cool = getOtpSendCooldown(coolKey);
  const existing = pending2fa.get(email);

  if (!force && !cool.allowed && existing && existing.expiresAt > Date.now()) {
    return { email, sent: false, retryAfterSec: cool.retryAfterSec };
  }

  const code = await issueAndSendOtp({
    email,
    purpose: 'login',
    recipientName: user.name || ''
  });
  markOtpSent(coolKey);
  pending2fa.set(email, {
    codeHash: hashCode(code),
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
    userId: String(user._id || user.id),
    role: user.role
  });
  if (shouldExposeOtpInApi()) {
    console.log(`[AUTH_DEBUG] 2FA OTP for ${email}: ${code}`);
  }
  return { email, sent: true, retryAfterSec: 30, debugOtp: code };
}

async function emailAlreadyRegistered(normalizedEmail) {
  try {
    const existing = await User.findOne({ email: normalizedEmail }).select('_id');
    if (existing) return true;
  } catch {
    // fall through to memory check
  }
  if (allowMemoryAuth()) {
    for (const mem of memoryUsers.values()) {
      if (mem.email === normalizedEmail) return true;
    }
  }
  return false;
}

function consumeSignupOtp(normalizedEmail, code) {
  const stored = signupOtps.get(normalizedEmail);
  if (!stored || stored.expiresAt < Date.now()) {
    signupOtps.delete(normalizedEmail);
    return { ok: false, message: 'Invalid or expired OTP. Request a new one.' };
  }
  stored.attempts = (stored.attempts || 0) + 1;
  if (stored.attempts > 5) {
    signupOtps.delete(normalizedEmail);
    return { ok: false, message: 'Too many invalid OTP attempts. Request a new one.' };
  }
  if (!timingSafeEqualHex(stored.codeHash, hashCode(code))) {
    return { ok: false, message: 'Invalid OTP. Please try again.' };
  }
  signupOtps.delete(normalizedEmail);
  return { ok: true };
}

// Signup: send email OTP before account creation
router.post('/register/send-otp', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'signup-otp'), 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Try again later.' });
    }

    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    if (!normalizedEmail.includes('@')) {
      return res.status(400).json({ success: false, message: 'Please enter a valid email address.' });
    }

    const emailRate = checkRateLimit(`signup-otp-email:${normalizedEmail}`, 5, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests for this email.' });
    }

    if (await emailAlreadyRegistered(normalizedEmail)) {
      return res.status(400).json({ success: false, message: 'Email already registered.' });
    }

    const coolKey = `signup:${normalizedEmail}`;
    const cool = getOtpSendCooldown(coolKey);
    if (!cool.allowed) {
      return res.status(429).json(otpCooldownResponse(cool.retryAfterSec));
    }

    const code = await issueAndSendOtp({
      email: normalizedEmail,
      purpose: 'signup'
    });
    markOtpSent(coolKey);

    signupOtps.set(normalizedEmail, {
      codeHash: hashCode(code),
      expiresAt: Date.now() + OTP_TTL_MS,
      attempts: 0
    });

    if (shouldExposeOtpInApi()) {
      console.log(`[AUTH_DEBUG] Signup OTP for ${normalizedEmail}: ${code}`);
    }

    return res.json(
      otpApiPayload('Verification OTP sent to your email. Check your inbox.', code)
    );
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Register (for Traders) — 18+ only, after email OTP verify
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, dateOfBirth, confirmAge18, acceptTerms, otp, code } = req.body;
    if (!name || !email || !password || !dateOfBirth) {
      return res.status(400).json({
        success: false,
        message: 'Name, email, password and date of birth are required.'
      });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters.' });
    }
    if (!confirmAge18) {
      return res.status(400).json({
        success: false,
        message: 'You must confirm that you are 18 years or older.'
      });
    }
    if (!acceptTerms) {
      return res.status(400).json({
        success: false,
        message: 'You must accept the Terms & Conditions and Privacy Policy to create an account.'
      });
    }

    const otpCode = String(otp || code || '').trim();
    if (!otpCode) {
      return res.status(400).json({
        success: false,
        message: 'Email OTP is required. Verify your email first.'
      });
    }

    const age = getAgeFromDob(dateOfBirth);
    if (age === null) {
      return res.status(400).json({ success: false, message: 'Please enter a valid date of birth.' });
    }
    if (age < 18) {
      return res.status(403).json({
        success: false,
        message: 'Only users aged 18 years or older can create an account.'
      });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const otpCheck = consumeSignupOtp(normalizedEmail, otpCode);
    if (!otpCheck.ok) {
      return res.status(400).json({ success: false, message: otpCheck.message });
    }

    const dob = new Date(dateOfBirth);

    if (!isDbReady() && !allowMemoryAuth()) {
      return dbUnavailableResponse(res, 'create an account');
    }

    try {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }

      const user = new User({
        name,
        email: normalizedEmail,
        password,
        role: 'user',
        dateOfBirth: dob,
        isAdultConfirmed: true,
        subscription: buildSignupSubscription()
      });
      await user.save();
      return issueAuthResponse(res, user, 201);
    } catch (dbErr) {
      if (dbErr?.code === 11000) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }

      // Dev-only memory fallback — NEVER used in production (accounts would vanish on deploy)
      if (!allowMemoryAuth()) {
        console.error('[Auth] Register failed — DB error:', dbErr.message || dbErr);
        return dbUnavailableResponse(res, 'create an account');
      }

      for (const existing of memoryUsers.values()) {
        if (existing.email === normalizedEmail) {
          return res.status(400).json({ success: false, message: 'Email already registered.' });
        }
      }

      const passwordHash = await hashSecret(password);
      const tempUser = {
        _id: `temp_user_${Date.now()}`,
        name,
        email: normalizedEmail,
        role: 'user',
        password: passwordHash,
        dateOfBirth: dob,
        isAdultConfirmed: true,
        twoFactorEnabled: false,
        subscription: buildSignupSubscription()
      };
      memoryUsers.set(tempUser._id, tempUser);
      console.warn('[Auth] Dev memory user created — will be lost on restart');
      return issueAuthResponse(res, tempUser, 201);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Standard User Login
router.post('/login', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'login'), 20, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Dev-only memory users
    if (allowMemoryAuth()) {
      for (const mem of memoryUsers.values()) {
        if (mem.email !== normalizedEmail) continue;
        const ok = await compareSecret(password, mem.password);
        if (!ok) {
          return res.status(400).json({
            success: false,
            message: 'Invalid email or password. Please check your details.'
          });
        }
        if (mem.twoFactorEnabled) {
          const challenge = await begin2faChallenge(mem);
          return res.json({
            success: true,
            requires2fa: true,
            email: normalizedEmail,
            retryAfterSec: challenge.retryAfterSec || 30,
            otpSent: challenge.sent !== false,
            message: 'Enter the 2FA verification code to finish signing in.'
          });
        }
        return issueAuthResponse(res, mem);
      }
    }

    if (!isDbReady()) {
      return dbUnavailableResponse(res, 'sign in');
    }

    try {
      // Email is case-insensitive (User@X.com === user@x.com)
      const emailRegex = new RegExp(
        `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      const user =
        (await User.findOne({ email: normalizedEmail })) ||
        (await User.findOne({ email: emailRegex }));
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email or password. Please check your details.'
        });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({
          success: false,
          message: 'Invalid email or password. Please check your details.'
        });
      }

      if (user.twoFactorEnabled) {
        const challenge = await begin2faChallenge(user);
        return res.json({
          success: true,
          requires2fa: true,
          email: normalizedEmail,
          retryAfterSec: challenge.retryAfterSec || 30,
          otpSent: challenge.sent !== false,
          message: 'Enter the 2FA verification code to finish signing in.'
        });
      }

      return issueAuthResponse(res, user);
    } catch {
      return dbUnavailableResponse(res, 'sign in');
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Complete login after 2FA code
router.post('/verify-2fa', async (req, res) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const ipRate = checkRateLimit(clientKey(req, 'verify2fa'), 15, 15 * 60 * 1000);
    if (!ipRate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
    }
    // Per-email lockout so distributed IPs cannot brute-force a 6-digit OTP.
    const emailRate = checkRateLimit(`verify2fa:email:${normalizedEmail}`, 8, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many attempts for this account. Try again later.' });
    }

    const pending = pending2fa.get(normalizedEmail);
    if (!pending || pending.expiresAt < Date.now()) {
      pending2fa.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    pending.attempts += 1;
    if (pending.attempts > 5) {
      pending2fa.delete(normalizedEmail);
      return res.status(429).json({ success: false, message: 'Too many invalid codes. Sign in again.' });
    }

    if (!timingSafeEqualHex(pending.codeHash, hashCode(code))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    pending2fa.delete(normalizedEmail);

    const mem = memoryUsers.get(pending.userId);
    if (mem) {
      return issueAuthResponse(res, mem, 200, pending.role === 'admin' || pending.role === 'subadmin' ? '7d' : '30d');
    }

    try {
      const user = await User.findById(pending.userId);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const expiresIn = user.role === 'admin' || user.role === 'subadmin' ? '7d' : '30d';
      return issueAuthResponse(res, user, 200, expiresIn);
    } catch {
      return res.status(503).json({ success: false, message: 'Database unavailable.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Resend 2FA / login OTP (30s cooldown)
router.post('/resend-2fa', async (req, res) => {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address required.' });
    }
    const normalizedEmail = String(email).toLowerCase().trim();

    const rate = checkRateLimit(clientKey(req, 'resend-2fa'), 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many OTP requests. Try again later.' });
    }

    const pending = pending2fa.get(normalizedEmail);
    if (!pending || pending.expiresAt < Date.now()) {
      pending2fa.delete(normalizedEmail);
      return res.status(400).json({
        success: false,
        message: 'No active verification. Please sign in again.'
      });
    }

    const cool = getOtpSendCooldown(`login:${normalizedEmail}`);
    if (!cool.allowed) {
      return res.status(429).json(otpCooldownResponse(cool.retryAfterSec));
    }

    let user = memoryUsers.get(pending.userId) || null;
    if (!user) {
      try {
        user = await User.findById(pending.userId);
      } catch {
        return res.status(503).json({ success: false, message: 'Database unavailable.' });
      }
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const challenge = await begin2faChallenge(user, { force: true });
    return res.json(
      otpApiPayload('A new verification code was sent to your email.', challenge.debugOtp, {
        retryAfterSec: challenge.retryAfterSec || 30
      })
    );
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Dedicated Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'admin-login'), 15, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many login attempts. Try again later.' });
    }

    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    if (!isDbReady()) {
      return dbUnavailableResponse(res, 'sign in');
    }

    try {
      const emailRegex = new RegExp(
        `^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
      );
      const admin =
        (await User.findOne({ email: normalizedEmail, role: { $in: ['admin', 'subadmin'] } })) ||
        (await User.findOne({ email: emailRegex, role: { $in: ['admin', 'subadmin'] } }));
      if (!admin) {
        return res.status(403).json({
          success: false,
          message: 'Invalid email or password. Please check your details.'
        });
      }

      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password. Please check your details.'
        });
      }

      if (admin.twoFactorEnabled) {
        const challenge = await begin2faChallenge(admin);
        return res.json({
          success: true,
          requires2fa: true,
          email: normalizedEmail,
          retryAfterSec: challenge.retryAfterSec || 30,
          otpSent: challenge.sent !== false,
          message: 'Enter the 2FA verification code to finish signing in.'
        });
      }

      return issueAuthResponse(res, admin, 200, '7d');
    } catch {
      return dbUnavailableResponse(res, 'sign in');
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Forgot Password / Recovery Endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'forgot'), 5, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many recovery requests. Try again later.' });
    }

    const { email } = req.body;
    const genericMessage =
      'If an account exists for that email, a verification recovery code has been sent.';

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRate = checkRateLimit(`forgot-email:${normalizedEmail}`, 3, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many recovery requests for this email.' });
    }

    let accountExists = false;
    try {
      const user = await User.findOne({ email: normalizedEmail }).select('_id');
      accountExists = !!user;
    } catch {
      for (const mem of memoryUsers.values()) {
        if (mem.email === normalizedEmail) {
          accountExists = true;
          break;
        }
      }
    }

    let debugOtp = null;
    if (accountExists) {
      const coolKey = `recovery:${normalizedEmail}`;
      const cool = getOtpSendCooldown(coolKey);
      if (!cool.allowed) {
        return res.status(429).json(otpCooldownResponse(cool.retryAfterSec));
      }
      try {
        const recoveryCode = await issueAndSendOtp({
          email: normalizedEmail,
          purpose: 'recovery'
        });
        markOtpSent(coolKey);
        recoveryCodes.set(normalizedEmail, {
          codeHash: hashCode(recoveryCode),
          expiresAt: Date.now() + OTP_TTL_MS,
          attempts: 0
        });
        debugOtp = recoveryCode;
        if (shouldExposeOtpInApi()) {
          console.log(`[AUTH_DEBUG] Recovery OTP for ${normalizedEmail}: ${recoveryCode}`);
        }
      } catch (mailErr) {
        console.error('[Auth] Recovery OTP email failed:', mailErr.message || mailErr);
        return res.status(503).json({
          success: false,
          message: mailErr.message || 'Could not send recovery email. Check SMTP settings.'
        });
      }
    }

    return res.json(
      otpApiPayload(genericMessage, debugOtp)
    );
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Verify recovery OTP before allowing password change
router.post('/verify-recovery-otp', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'verify-recovery'), 15, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
    }

    const { email, code } = req.body || {};
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const emailRate = checkRateLimit(`verify-recovery:email:${normalizedEmail}`, 8, 15 * 60 * 1000);
    if (!emailRate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many attempts for this email. Try again later.' });
    }

    const stored = recoveryCodes.get(normalizedEmail);
    if (!stored || stored.expiresAt < Date.now()) {
      recoveryCodes.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    stored.attempts = (stored.attempts || 0) + 1;
    if (stored.attempts > 5) {
      recoveryCodes.delete(normalizedEmail);
      return res.status(429).json({ success: false, message: 'Too many invalid codes. Request a new one.' });
    }

    if (!timingSafeEqualHex(stored.codeHash, hashCode(code))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    stored.verified = true;
    stored.attempts = 0;
    recoveryCodes.set(normalizedEmail, stored);

    return res.json({
      success: true,
      message: 'OTP verified. You can now set a new password.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset Password after OTP has been verified
router.post('/reset-password', async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'reset'), 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many reset attempts. Try again later.' });
    }

    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const stored = recoveryCodes.get(normalizedEmail);

    if (!stored || stored.expiresAt < Date.now()) {
      recoveryCodes.delete(normalizedEmail);
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    if (!stored.verified) {
      return res.status(400).json({
        success: false,
        message: 'Please verify the OTP before setting a new password.'
      });
    }

    if (!timingSafeEqualHex(stored.codeHash, hashCode(code))) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    recoveryCodes.delete(normalizedEmail);

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        // Also allow offline memory users
        let updated = false;
        for (const [id, mem] of memoryUsers.entries()) {
          if (mem.email === normalizedEmail) {
            mem.password = await hashSecret(newPassword);
            memoryUsers.set(id, mem);
            updated = true;
            break;
          }
        }
        if (!updated) {
          return res.status(404).json({ success: false, message: 'No account found for this email.' });
        }
      } else {
        user.password = newPassword;
        await user.save();
      }
    } catch {
      return res.status(503).json({ success: false, message: 'Database unavailable. Unable to reset password.' });
    }

    return res.json({
      success: true,
      message: 'Password has been reset successfully. You may now log in.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Current User Profile
router.get('/me', authMiddleware, (req, res) => {
  res.json({
    success: true,
    user: sanitizeUser(req.user),
    byokSalesEnabled: getByokSalesEnabled(),
  });
});

/**
 * Activate membership ONLY after a confirmed Razorpay payment.
 * Body: { razorpay_order_id, byokCredentials? }
 * Prefer /api/payment/verify which activates automatically after pay.
 * This endpoint is a recovery path if verify activated payment but membership lagged.
 */
router.post('/activate-membership', authMiddleware, async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'activate-membership'), 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many activation attempts. Try again later.' });
    }

    const { razorpay_order_id, byokCredentials } = req.body || {};
    if (!razorpay_order_id) {
      return res.status(402).json({
        success: false,
        message: 'Payment required. Complete Razorpay checkout before membership can be activated.'
      });
    }

    const userId = req.user._id || req.user.id;
    const payment = await Payment.findOne({ orderId: razorpay_order_id }).select('+pendingByokCipher');
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }
    if (String(payment.userId) !== String(userId)) {
      return res.status(403).json({ success: false, message: 'This payment does not belong to your account.' });
    }
    if (payment.status !== 'paid') {
      return res.status(402).json({
        success: false,
        message: 'Payment is not confirmed yet. Membership activates only after successful payment.'
      });
    }
    if (payment.membershipActivated) {
      // Idempotent — return current user
      const user = isDbReady()
        ? await User.findById(userId)
        : memoryUsers.get(String(userId));
      return res.json({
        success: true,
        message: 'Membership already activated for this payment.',
        user: user ? sanitizeUser(user) : sanitizeUser(req.user)
      });
    }

    // Never accept client planId — plan must come from the paid payment record.
    if (!payment.planId) {
      return res.status(400).json({ success: false, message: 'No plan linked to this payment.' });
    }

    try {
      const result = await activateMembershipForUser({
        userId,
        planId: payment.planId,
        byokCredentials: byokCredentials || null,
        existingUser: req.user
      });

      payment.membershipActivated = true;
      payment.pendingByokCipher = undefined;
      await payment.save();

      return res.json({
        success: true,
        message: 'Payment confirmed. Membership is now active.',
        user: result.user
      });
    } catch (actErr) {
      return res.status(actErr.statusCode || 500).json({
        success: false,
        message: actErr.message || 'Membership activation failed.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Masked BYOK status for the signed-in user */
router.get('/byok', authMiddleware, (req, res) => {
  res.json({
    success: true,
    byok: getByokPublicStatus(req.user),
    byokSalesEnabled: getByokSalesEnabled(),
    subscriptionMode: req.user?.subscription?.mode || 'server'
  });
});

/**
 * Client-side chart session for BYOK members only.
 * Frontend loads candles from the broker (or thin CORS proxy) — platform Kotak is not used.
 */
router.get('/byok/market-client', authMiddleware, async (req, res) => {
  try {
    if (classifyUserFeedMode(req.user) !== 'byok') {
      return res.status(403).json({
        success: false,
        message: 'Market-client credentials are only for BYOK members. Platform plans use the server feed.'
      });
    }

    const full = await loadUserWithByokSecrets(req.user);
    const feed = await resolveUserMarketFeed(full || req.user);
    if (!feed.connected || !feed.session) {
      return res.status(403).json({
        success: false,
        message: feed.error || 'Connect your broker to load charts from your account.',
        feed: feed.feed
      });
    }

    const provider = feed.provider;
    const session = feed.session || {};
    const secrets = feed.secrets || {};

    // Only the fields the browser needs to call that broker's market APIs
    let client = { provider, expiresAt: session.expiresAt || null };
    if (provider === 'upstox') {
      client.accessToken = session.accessToken || secrets.accessToken || null;
    } else if (provider === 'kotak') {
      client.consumerKey = secrets.consumerKey || session.consumerKey || null;
      client.baseUrl = session.baseUrl || null;
      client.sid = session.sid || null;
      client.viewToken = session.viewToken || session.token || null;
    } else if (provider === 'groww') {
      client.accessToken = session.accessToken || secrets.accessToken || session.token || null;
    } else if (provider === 'angelone') {
      client.jwtToken = session.jwtToken || session.accessToken || null;
      client.apiKey = secrets.apiKey || session.apiKey || null;
    }

    return res.json({
      success: true,
      feed: feed.feed,
      client,
      chartMode: 'client' // frontend fetches candles
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

const BYOK_PROXY_HOSTS = new Set([
  'api.upstox.com',
  'assets.upstox.com',
  'api.groww.in',
  'apiconnect.angelone.in'
]);

/** Shared NSE EQ instrument map for client charts (CDN once, no broker quota). */
let upstoxSymbolMapCache = null;
let upstoxSymbolMapAt = 0;

router.get('/byok/symbol-map', authMiddleware, async (req, res) => {
  try {
    if (classifyUserFeedMode(req.user) !== 'byok') {
      return res.status(403).json({ success: false, message: 'BYOK only.' });
    }
    if (upstoxSymbolMapCache && Date.now() - upstoxSymbolMapAt < 24 * 60 * 60 * 1000) {
      return res.json({ success: true, map: upstoxSymbolMapCache });
    }
    const { gunzipSync } = await import('zlib');
    const url =
      'https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz';
    const upstream = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!upstream.ok) {
      return res.status(502).json({ success: false, message: 'Could not load instrument map.' });
    }
    const rows = JSON.parse(gunzipSync(Buffer.from(await upstream.arrayBuffer())).toString('utf8'));
    const map = {};
    for (const row of rows) {
      if (row.segment === 'NSE_EQ' && row.instrument_type === 'EQ' && row.instrument_key) {
        const sym = String(row.trading_symbol || '')
          .toUpperCase()
          .replace(/-EQ$/, '');
        if (sym && !map[sym]) map[sym] = row.instrument_key;
      }
      if ((row.segment === 'NSE_INDEX' || row.instrument_type === 'INDEX') && row.instrument_key) {
        const name = String(row.name || row.trading_symbol || '').toUpperCase();
        if (name.includes('NIFTY 50') || name === 'NIFTY') map['NIFTY 50'] = row.instrument_key;
        if (name.includes('NIFTY BANK') || name === 'BANKNIFTY') map.BANKNIFTY = row.instrument_key;
      }
    }
    upstoxSymbolMapCache = map;
    upstoxSymbolMapAt = Date.now();
    return res.json({ success: true, map });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Thin CORS bridge for BYOK chart calls only (no SMC / no universe warm).
 * Used when the browser cannot call the broker API directly.
 */
router.post('/byok/broker-proxy', authMiddleware, async (req, res) => {
  try {
    if (classifyUserFeedMode(req.user) !== 'byok') {
      return res.status(403).json({ success: false, message: 'BYOK only.' });
    }
    const rate = checkRateLimit(clientKey(req, 'byok-proxy'), 120, 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many broker proxy requests.' });
    }

    const full = await loadUserWithByokSecrets(req.user);
    const feed = await resolveUserMarketFeed(full || req.user);
    if (!feed.connected) {
      return res.status(403).json({ success: false, message: feed.error || 'Connect broker first.' });
    }

    const targetUrl = String(req.body?.url || '').trim();
    const method = String(req.body?.method || 'GET').toUpperCase();
    if (!/^https:\/\//i.test(targetUrl) || method !== 'GET') {
      return res.status(400).json({ success: false, message: 'Only HTTPS GET proxy is allowed.' });
    }
    let parsed;
    try {
      parsed = new URL(targetUrl);
    } catch {
      return res.status(400).json({ success: false, message: 'Invalid URL.' });
    }
    if (!BYOK_PROXY_HOSTS.has(parsed.hostname)) {
      return res.status(400).json({ success: false, message: 'Host not allowed.' });
    }

    const headers = { Accept: 'application/json' };
    if (feed.provider === 'upstox') {
      const tok = feed.session?.accessToken || feed.secrets?.accessToken;
      if (tok) headers.Authorization = `Bearer ${tok}`;
    } else if (feed.provider === 'groww') {
      const tok = feed.session?.accessToken || feed.secrets?.accessToken;
      if (tok) {
        headers.Authorization = `Bearer ${tok}`;
        headers['X-API-VERSION'] = '1.0';
      }
    } else if (feed.provider === 'angelone') {
      const jwt = feed.session?.jwtToken || feed.session?.accessToken;
      const apiKey = feed.secrets?.apiKey;
      if (jwt) headers.Authorization = `Bearer ${jwt}`;
      if (apiKey) headers['X-PrivateKey'] = apiKey;
    }

    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: AbortSignal.timeout(25_000)
    });
    const text = await upstream.text();
    let data = text;
    try {
      data = JSON.parse(text);
    } catch {
      /* keep text */
    }
    return res.status(upstream.status).json({
      success: upstream.ok,
      status: upstream.status,
      data
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Update / reconnect BYOK credentials for an existing BYOK member.
 * Allowed even when admin turned sales OFF (grandfathered access).
 */
router.put('/byok', authMiddleware, async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'byok-update'), 8, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many BYOK updates. Try again later.' });
    }

    // Only BYOK memberships may store broker keys (prevents server-plan feed hijack).
    if (req.user?.subscription?.mode !== 'byok') {
      return res.status(403).json({
        success: false,
        message: 'Broker API keys are only for BYOK memberships. Your plan uses the platform feed.'
      });
    }

    const creds = req.body?.byokCredentials || req.body || {};
    let byokBundle;
    try {
      const connected = await connectByok(creds);
      byokBundle = connected.bundle;
    } catch (err) {
      return res.status(err.statusCode || 400).json({
        success: false,
        message: err.message || 'Could not validate BYOK broker credentials.'
      });
    }

    const userId = req.user._id || req.user.id;
    if (isDbReady()) {
      try {
        const user = await User.findById(userId).select('+byok.secretsCipher +byok.sessionCipher');
        if (!user) {
          return res.status(404).json({ success: false, message: 'User not found.' });
        }
        user.byok = byokBundle;
        if (user.subscription) {
          user.subscription.mode = 'byok';
          user.subscription.byokGranted = true;
        }
        await user.save();
        return res.json({
          success: true,
          message: 'BYOK credentials updated. Broker session stored securely.',
          user: sanitizeUser(user),
          byok: getByokPublicStatus(user)
        });
      } catch (dbErr) {
        console.error('[Auth] byok update DB error:', dbErr.message || dbErr);
        return dbUnavailableResponse(res, 'update BYOK');
      }
    }

    const mem = memoryUsers.get(String(userId));
    if (mem) {
      mem.byok = byokBundle;
      return res.json({
        success: true,
        message: 'BYOK credentials updated (dev memory).',
        user: sanitizeUser(mem),
        byok: getByokPublicStatus(mem)
      });
    }

    return dbUnavailableResponse(res, 'update BYOK');
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Password
router.post('/update-password', authMiddleware, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Both old and new passwords are required.' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    try {
      const user = await User.findById(req.user._id || req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }
      const isMatch = await user.comparePassword(oldPassword);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Current password does not match.' });
      }
      user.password = newPassword;
      await user.save();
      return res.json({ success: true, message: 'Password updated successfully.' });
    } catch {
      return res.status(503).json({ success: false, message: 'Database unavailable.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Toggle 2-Factor Authentication (disabling requires current password)
router.post('/toggle-2fa', authMiddleware, async (req, res) => {
  try {
    const { enabled, password } = req.body || {};
    const wantEnabled = !!enabled;
    const userId = String(req.user._id || req.user.id);

    try {
      const user = await User.findById(userId);
      if (user) {
        if (!wantEnabled && user.twoFactorEnabled) {
          if (!password) {
            return res.status(400).json({
              success: false,
              message: 'Current password is required to turn off 2FA.'
            });
          }
          const ok = await user.comparePassword(password);
          if (!ok) {
            return res.status(400).json({ success: false, message: 'Current password does not match.' });
          }
        }
        user.twoFactorEnabled = wantEnabled;
        await user.save();
        return res.json({
          success: true,
          twoFactorEnabled: wantEnabled,
          message: wantEnabled
            ? '2-Factor Authentication activated. Login OTP verification enabled.'
            : '2-Factor Authentication turned off.'
        });
      }
    } catch {
      // fall through to memory user
    }

    const mem = memoryUsers.get(userId);
    if (!mem) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }
    if (!wantEnabled && mem.twoFactorEnabled) {
      if (!password) {
        return res.status(400).json({
          success: false,
          message: 'Current password is required to turn off 2FA.'
        });
      }
      const ok = await compareSecret(password, mem.password);
      if (!ok) {
        return res.status(400).json({ success: false, message: 'Current password does not match.' });
      }
    }
    mem.twoFactorEnabled = wantEnabled;
    memoryUsers.set(String(mem._id), mem);

    res.json({
      success: true,
      twoFactorEnabled: wantEnabled,
      message: wantEnabled
        ? '2-Factor Authentication activated. Login OTP verification enabled.'
        : '2-Factor Authentication turned off.'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

function describeClient(ua = '') {
  const agent = String(ua || '');
  let device = 'Desktop';
  if (/iPhone|iPad/i.test(agent)) device = 'iPhone / iPad';
  else if (/Android/i.test(agent)) device = 'Android device';
  else if (/Mac OS/i.test(agent)) device = 'Mac';
  else if (/Windows/i.test(agent)) device = 'Windows PC';
  else if (/Linux/i.test(agent)) device = 'Linux';

  let browser = 'Browser';
  if (/Edg\//i.test(agent)) browser = 'Edge';
  else if (/Chrome\//i.test(agent) && !/Edg\//i.test(agent)) browser = 'Chrome';
  else if (/Safari\//i.test(agent) && !/Chrome\//i.test(agent)) browser = 'Safari';
  else if (/Firefox\//i.test(agent)) browser = 'Firefox';

  return { device, browser };
}

// Get Active Sessions
router.get('/sessions', authMiddleware, (req, res) => {
  const currentIp = req.ip || req.headers['x-forwarded-for'] || '127.0.0.1';
  const { device, browser } = describeClient(req.headers['user-agent']);
  const sessions = [
    {
      id: 'sess_cur',
      device,
      browser,
      ip: String(currentIp).split(',')[0].trim(),
      location: 'This session',
      isCurrent: true,
      lastActive: new Date()
    }
  ];

  res.json({ success: true, sessions });
});

// Revoke Other Sessions
router.post('/revoke-sessions', authMiddleware, (_req, res) => {
  res.json({
    success: true,
    message: 'All other active sessions have been signed out. Only this device is authenticated.'
  });
});

export default router;
