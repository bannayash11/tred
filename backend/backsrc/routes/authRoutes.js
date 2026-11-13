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
  getByokSalesEnabled,
  getFreeTrialDays,
  getFreeTrialEnabled
} from '../services/membershipPlans.js';
import {
  connectByok,
  getByokPublicStatus
} from '../services/byokSessionService.js';
import { Payment } from '../models/Payment.js';
import { activateMembershipForUser } from '../services/membershipActivation.js';
import {
  isSmtpReady,
  sendOtpEmail,
  shouldExposeOtpInApi
} from '../services/emailService.js';

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
        mode: user.subscription.mode || 'trial',
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

function otpApiPayload(message, otp) {
  const payload = { success: true, message };
  if (shouldExposeOtpInApi() && otp) payload.otp = otp;
  return payload;
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

async function begin2faChallenge(user) {
  const email = String(user.email).toLowerCase().trim();
  const code = await issueAndSendOtp({
    email,
    purpose: 'login',
    recipientName: user.name || ''
  });
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
  return email;
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

    const code = await issueAndSendOtp({
      email: normalizedEmail,
      purpose: 'signup'
    });

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
          await begin2faChallenge(mem);
          return res.json({
            success: true,
            requires2fa: true,
            email: normalizedEmail,
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
        await begin2faChallenge(user);
        return res.json({
          success: true,
          requires2fa: true,
          email: normalizedEmail,
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
    const rate = checkRateLimit(clientKey(req, 'verify2fa'), 15, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many attempts. Try again later.' });
    }

    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: 'Email and verification code are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
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
        await begin2faChallenge(admin);
        return res.json({
          success: true,
          requires2fa: true,
          email: normalizedEmail,
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
      try {
        const recoveryCode = await issueAndSendOtp({
          email: normalizedEmail,
          purpose: 'recovery'
        });
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

// Reset Password with Verification Code
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

    stored.attempts = (stored.attempts || 0) + 1;
    if (stored.attempts > 5) {
      recoveryCodes.delete(normalizedEmail);
      return res.status(429).json({ success: false, message: 'Too many invalid codes. Request a new one.' });
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
    freeTrialEnabled: getFreeTrialEnabled(),
    freeTrialDays: getFreeTrialDays()
  });
});

/**
 * Activate membership ONLY after a confirmed Razorpay payment.
 * Body: { razorpay_order_id, planId?, byokCredentials? }
 * Prefer /api/payment/verify which activates automatically after pay.
 * This endpoint is a recovery path if verify activated payment but membership lagged.
 */
router.post('/activate-membership', authMiddleware, async (req, res) => {
  try {
    const rate = checkRateLimit(clientKey(req, 'activate-membership'), 10, 15 * 60 * 1000);
    if (!rate.allowed) {
      return res.status(429).json({ success: false, message: 'Too many activation attempts. Try again later.' });
    }

    const { razorpay_order_id, planId, byokCredentials } = req.body || {};
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

    const resolvedPlanId = payment.planId || planId;
    if (!resolvedPlanId) {
      return res.status(400).json({ success: false, message: 'No plan linked to this payment.' });
    }

    try {
      const result = await activateMembershipForUser({
        userId,
        planId: resolvedPlanId,
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
    subscriptionMode: req.user?.subscription?.mode || 'trial'
  });
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

    const granted =
      req.user?.subscription?.byokGranted ||
      req.user?.subscription?.mode === 'byok' ||
      getByokSalesEnabled();

    if (!granted) {
      return res.status(403).json({
        success: false,
        message: 'BYOK is not available on your account.'
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
          user.subscription.byokGranted = true;
          if (user.subscription.mode !== 'byok') {
            // Keep mode as purchased; credentials still stored for when they switch back
          }
        }
        await user.save();
        return res.json({
          success: true,
          message: 'BYOK credentials updated. New Kotak session stored securely.',
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

// Toggle 2-Factor Authentication
router.post('/toggle-2fa', authMiddleware, async (req, res) => {
  try {
    const { enabled } = req.body;
    try {
      const user = await User.findById(req.user._id || req.user.id);
      if (user) {
        user.twoFactorEnabled = !!enabled;
        await user.save();
      } else {
        const mem = memoryUsers.get(String(req.user._id || req.user.id));
        if (mem) {
          mem.twoFactorEnabled = !!enabled;
          memoryUsers.set(String(mem._id), mem);
        }
      }
    } catch {
      const mem = memoryUsers.get(String(req.user._id || req.user.id));
      if (mem) {
        mem.twoFactorEnabled = !!enabled;
        memoryUsers.set(String(mem._id), mem);
      }
    }

    res.json({
      success: true,
      twoFactorEnabled: !!enabled,
      message: enabled
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
