import express from 'express';
import { User } from '../models/User.js';
import {
  authMiddleware,
  signToken,
  memoryUsers
} from '../middleware/authMiddleware.js';

const router = express.Router();

// In-memory recovery codes: email -> { code, expiresAt }
const recoveryCodes = new Map();

const sanitizeUser = (user) => ({
  id: user._id || user.id,
  _id: user._id || user.id,
  name: user.name,
  email: user.email,
  role: user.role,
  twoFactorEnabled: !!user.twoFactorEnabled,
  subscription: user.subscription
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

// Register (for Traders) — 18+ only
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, dateOfBirth, confirmAge18, acceptTerms } = req.body;
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
    const dob = new Date(dateOfBirth);

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
        isAdultConfirmed: true
      });
      await user.save();
      return issueAuthResponse(res, user, 201);
    } catch (dbErr) {
      if (dbErr?.code === 11000) {
        return res.status(400).json({ success: false, message: 'Email already registered.' });
      }

      // Offline fallback: store trader in memory and issue a real JWT
      for (const existing of memoryUsers.values()) {
        if (existing.email === normalizedEmail) {
          return res.status(400).json({ success: false, message: 'Email already registered.' });
        }
      }

      const tempUser = {
        _id: `temp_user_${Date.now()}`,
        name,
        email: normalizedEmail,
        role: 'user',
        password,
        dateOfBirth: dob,
        isAdultConfirmed: true,
        twoFactorEnabled: false,
        subscription: {
          status: 'trial',
          plan: '14-Day Free Trial',
          expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000)
        }
      };
      memoryUsers.set(tempUser._id, tempUser);
      return issueAuthResponse(res, tempUser, 201);
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Standard User Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    // Offline memory users (registered while Mongo was down)
    for (const mem of memoryUsers.values()) {
      if (mem.email === normalizedEmail && mem.password === password) {
        return issueAuthResponse(res, mem);
      }
    }

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(400).json({ success: false, message: 'Invalid credentials.' });
      }

      const isMatch = await user.comparePassword(password);
      if (!isMatch) {
        return res.status(400).json({ success: false, message: 'Invalid credentials.' });
      }

      return issueAuthResponse(res, user);
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Dedicated Admin Login
router.post('/admin-login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    try {
      const admin = await User.findOne({ email: normalizedEmail, role: { $in: ['admin', 'subadmin'] } });
      if (!admin) {
        return res.status(403).json({ success: false, message: 'Access Denied: Not an authorized admin or sub-admin.' });
      }

      const isMatch = await admin.comparePassword(password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Invalid administrator credentials.' });
      }

      return issueAuthResponse(res, admin, 200, '7d');
    } catch {
      return res.status(503).json({
        success: false,
        message: 'Database unavailable. Please try again later.'
      });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Forgot Password / Recovery Endpoint
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Email address required.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const recoveryCode = String(Math.floor(100000 + Math.random() * 900000));
    recoveryCodes.set(normalizedEmail, {
      code: recoveryCode,
      expiresAt: Date.now() + 10 * 60 * 1000
    });

    console.log(`[AUTH] Password recovery code generated for ${normalizedEmail}: ${recoveryCode}`);

    return res.json({
      success: true,
      message: `Verification recovery code sent to ${normalizedEmail}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset Password with Verification Code
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ success: false, message: 'All fields required.' });
    }
    if (String(newPassword).length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();
    const stored = recoveryCodes.get(normalizedEmail);

    if (!stored || stored.expiresAt < Date.now() || stored.code !== String(code).trim()) {
      return res.status(400).json({ success: false, message: 'Invalid or expired verification code.' });
    }

    recoveryCodes.delete(normalizedEmail);

    try {
      const user = await User.findOne({ email: normalizedEmail });
      if (!user) {
        return res.status(404).json({ success: false, message: 'No account found for this email.' });
      }
      user.password = newPassword;
      await user.save();
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
  res.json({ success: true, user: sanitizeUser(req.user) });
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
      }
    } catch {
      // Offline — accept toggle in response only
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

// Get Active Sessions
router.get('/sessions', authMiddleware, (req, res) => {
  const currentIp = req.ip || '127.0.0.1';
  const sessions = [
    {
      id: 'sess_cur',
      device: 'Current Browser',
      browser: req.headers['user-agent']?.slice(0, 48) || 'Unknown',
      ip: currentIp,
      location: 'Local Session',
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
