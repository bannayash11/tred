import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { User } from '../models/User.js';
import { authMiddleware, adminOnly, subAdminOrAdmin } from '../middleware/authMiddleware.js';
import { marketDataService } from '../services/marketDataService.js';
import { openingMomentumService } from '../services/openingMomentumService.js';
import { maskBrokerSettings } from '../utils/security.js';
import {
  DURATION_MONTH_OPTIONS,
  normalizePlan,
  getPlans,
  setPlans,
  getByokSalesEnabled,
  setByokSalesEnabled,
  persistByokSettings,
  persistPlans,
  getFreeTrialEnabled,
  getFreeTrialDays,
  setFreeTrialSettings,
  persistFreeTrialSettings,
  getPaymentMethodsSettings,
  setPaymentMethodsSettings,
  persistPaymentMethodsSettings,
  getUtrPayDetails,
  setUtrPayDetails,
  persistUtrPayDetails,
  buildSignupSubscription
} from '../services/membershipPlans.js';
import { getByokPublicStatus } from '../services/byokSessionService.js';
import {
  getPublicSmtpSettings,
  setSmtpSettings,
  persistSmtpSettings,
  sendTestSmtpEmail,
  isSmtpReady,
  getEmailTemplatesPublic,
  setEmailTemplate,
  resetEmailTemplate,
  persistEmailTemplates,
  getTemplateVariableHelp,
  renderTemplateString
} from '../services/emailService.js';
import {
  getSocialMediaAdmin,
  getPublicSocialMedia,
  setSocialMediaSettings,
  persistSocialMediaSettings
} from '../services/socialMediaService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_DIR = path.resolve(__dirname, '../../uploads');

const UTR_QR_MIME = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp'
};

function publicBaseFromReq(req) {
  const envBase = String(process.env.BACKEND_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (envBase) return envBase;
  const proto = String(req.headers['x-forwarded-proto'] || req.protocol || 'http').split(',')[0].trim();
  const host = String(req.headers['x-forwarded-host'] || req.get('host') || 'localhost:5001')
    .split(',')[0]
    .trim();
  return `${proto}://${host}`;
}

const router = express.Router();

// Offline fallback only — starts empty (no demo traders)
let inMemoryUsers = [];

let systemSettings = {
  announcement: '🔴 Live Market Updates Active: High institutional volume detected in Nifty Banking & Auto sectors.',
  announcementEnabled: true,
  brokerProvider: 'DHAN',
  dhanConfig: {
    clientId: '1100293847',
    accessToken: '••••••••••••••••••••••••••••••••',
    isConnected: true
  }
};

// 1. GET Admin Overview & Stats
router.get('/overview', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    let users = [];
    try {
      users = await User.find().select('-password').sort({ createdAt: -1 });
    } catch {
      users = inMemoryUsers.map(({ password: _pw, ...safe }) => safe);
    }

    const totalUsers = users.length;
    const activeSubscribers = users.filter(u => u.subscription?.status === 'active').length;
    const trialUsers = users.filter(u => u.subscription?.status === 'trial').length;
    const estimatedMRR = activeSubscribers * 1250;

    const usersWithByok = users.map((u) => {
      const plain = typeof u.toObject === 'function' ? u.toObject() : u;
      return {
        ...plain,
        byokStatus: getByokPublicStatus(plain)
      };
    });

    res.json({
      success: true,
      stats: { totalUsers, activeSubscribers, trialUsers, estimatedMRR },
      users: usersWithByok,
      plans: getPlans(),
      settings: {
        ...maskBrokerSettings(systemSettings),
        byokSalesEnabled: getByokSalesEnabled(),
        freeTrialEnabled: getFreeTrialEnabled(),
        freeTrialDays: getFreeTrialDays(),
        ...getPaymentMethodsSettings(),
        utrPay: getUtrPayDetails(),
        smtp: getPublicSmtpSettings(),
        social: getSocialMediaAdmin()
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= USER CRUD =================

// CREATE USER
router.post('/users', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const { name, email, password, role, plan, status, durationDays } = req.body;
    if (!name || !email) {
      return res.status(400).json({ success: false, message: 'Name and email are required' });
    }

    let safeRole = role || 'user';
    if (safeRole === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can create admin accounts.' });
    }
    if (safeRole === 'subadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can create sub-admin accounts.' });
    }
    if (!['user', 'subadmin', 'admin'].includes(safeRole)) {
      safeRole = 'user';
    }

    if (!password || String(password).length < 8) {
      return res.status(400).json({
        success: false,
        message: 'A strong password is required (minimum 8 characters).'
      });
    }

    const signupSub = buildSignupSubscription();
    const days = Number(durationDays);
    const expiresAt =
      Number.isFinite(days) && days > 0
        ? new Date(Date.now() + days * 24 * 3600 * 1000)
        : signupSub.expiresAt;
    const newUser = {
      _id: `usr_${Date.now()}`,
      name,
      email,
      role: safeRole,
      subscription: {
        status: status || signupSub.status,
        plan: plan || signupSub.plan,
        planId: null,
        mode: status === 'active' ? 'server' : signupSub.mode,
        byokGranted: false,
        expiresAt
      },
      createdAt: new Date()
    };

    try {
      const u = new User({ ...newUser, password });
      await u.save();
    } catch {
      // In-memory fallback — never store plaintext passwords
      const { hashSecret } = await import('../utils/security.js');
      inMemoryUsers.unshift({ ...newUser, password: await hashSecret(password) });
    }

    res.status(201).json({ success: true, message: 'Trader created successfully', user: newUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// BULK IMPORT USERS (CSV / JSON)
router.post('/users/import', authMiddleware, adminOnly, async (req, res) => {
  try {
    const rows = Array.isArray(req.body?.users) ? req.body.users : [];
    if (!rows.length) {
      return res.status(400).json({ success: false, message: 'No user rows to import.' });
    }
    if (rows.length > 1000) {
      return res.status(400).json({ success: false, message: 'Import limit is 1000 users per request.' });
    }

    let created = 0;
    let updated = 0;
    let skipped = 0;
    const errors = [];

    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i] || {};
      const email = String(row.email || '')
        .trim()
        .toLowerCase();
      const name = String(row.name || '').trim();
      if (!email || !name) {
        skipped += 1;
        errors.push({ row: i + 1, message: 'name and email are required.' });
        continue;
      }

      let role = String(row.role || 'user').trim().toLowerCase();
      if (!['user', 'subadmin', 'admin'].includes(role)) role = 'user';
      if ((role === 'admin' || role === 'subadmin') && req.user.role !== 'admin') {
        skipped += 1;
        errors.push({ row: i + 1, email, message: 'Only Super Admin can import admin/subadmin roles.' });
        continue;
      }

      const plan = String(row.plan || row.subscriptionPlan || 'No Active Plan').trim();
      let status = String(row.status || row.subscriptionStatus || 'expired').trim().toLowerCase();
      if (!['active', 'trial', 'expired'].includes(status)) status = 'expired';

      const password = String(row.password || '').trim() || `Import@${Math.random().toString(36).slice(2, 10)}a1`;
      const days = Number(row.durationDays || row.days);
      const expiresAt =
        row.expiresAt && !Number.isNaN(Date.parse(row.expiresAt))
          ? new Date(row.expiresAt)
          : Number.isFinite(days) && days > 0
            ? new Date(Date.now() + days * 24 * 3600 * 1000)
            : new Date(Date.now() - 60_000);

      try {
        const existing = await User.findOne({ email });
        if (existing) {
          existing.name = name;
          existing.role = role;
          existing.subscription = {
            ...(existing.subscription?.toObject?.() || existing.subscription || {}),
            status,
            plan,
            expiresAt
          };
          if (row.password && String(row.password).trim().length >= 8) {
            existing.password = String(row.password).trim();
          }
          await existing.save();
          updated += 1;
        } else {
          if (String(password).length < 8) {
            skipped += 1;
            errors.push({ row: i + 1, email, message: 'Password must be at least 8 characters.' });
            continue;
          }
          await User.create({
            name,
            email,
            password,
            role,
            subscription: {
              status,
              plan,
              planId: null,
              mode: status === 'active' ? 'server' : 'server',
              byokGranted: false,
              expiresAt
            }
          });
          created += 1;
        }
      } catch (err) {
        skipped += 1;
        errors.push({ row: i + 1, email, message: err.message || 'Import failed' });
      }
    }

    return res.json({
      success: true,
      message: `Import done — ${created} created, ${updated} updated, ${skipped} skipped.`,
      created,
      updated,
      skipped,
      errors: errors.slice(0, 50)
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// UPDATE USER
router.put('/users/:id', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, plan, status, extendDays } = req.body;

    if (role === 'admin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can assign admin role.' });
    }
    if (role === 'subadmin' && req.user.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Only Super Admin can assign sub-admin role.' });
    }

    let updatedUser = null;
    try {
      const u = await User.findById(id);
      if (u) {
        if (name) u.name = name;
        if (email) u.email = email;
        if (role) u.role = role;
        if (plan) u.subscription.plan = plan;
        if (status) u.subscription.status = status;
        if (extendDays) u.subscription.expiresAt = new Date(Date.now() + extendDays * 24 * 3600 * 1000);
        await u.save();
        updatedUser = u;
      }
    } catch {
      // fallback
    }

    if (!updatedUser) {
      const u = inMemoryUsers.find(x => x._id === id);
      if (u) {
        if (name) u.name = name;
        if (email) u.email = email;
        if (role) u.role = role;
        if (plan) u.subscription.plan = plan;
        if (status) u.subscription.status = status;
        if (extendDays) u.subscription.expiresAt = new Date(Date.now() + extendDays * 24 * 3600 * 1000);
        updatedUser = u;
      }
    }

    if (!updatedUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    res.json({ success: true, message: 'Trader details updated', user: updatedUser });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE USER
router.delete('/users/:id', authMiddleware, adminOnly, async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await User.findByIdAndDelete(id);
    } catch {
      // fallback
    }
    inMemoryUsers = inMemoryUsers.filter(x => x._id !== id);
    res.json({ success: true, message: 'Trader removed from platform' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// QUICK EXTEND USER SUB
router.post('/users/:id/subscription', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, plan, extendDays } = req.body;
    const newExpiry = new Date(Date.now() + (extendDays || 30) * 24 * 3600 * 1000);

    const u = inMemoryUsers.find(item => item._id === id);
    if (u) {
      if (status) u.subscription.status = status;
      if (plan) u.subscription.plan = plan;
      if (extendDays) u.subscription.expiresAt = newExpiry;
      return res.json({ success: true, message: 'Subscription updated', user: u });
    }
    res.status(404).json({ success: false, message: 'User not found' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= PLANS CRUD =================

// Public: only enabled plans for website pricing / membership
// When BYOK sales are off, BYOK plans are hidden (existing BYOK members keep access).
router.get('/public-plans', (req, res) => {
  const byokOn = getByokSalesEnabled();
  const plans = getPlans()
    .filter((p) => p.enabled !== false)
    .filter((p) => (p.mode === 'byok' ? byokOn : true))
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.json({
    success: true,
    plans,
    byokSalesEnabled: byokOn,
    freeTrialEnabled: getFreeTrialEnabled(),
    freeTrialDays: getFreeTrialDays()
  });
});

router.get('/plans', authMiddleware, subAdminOrAdmin, (req, res) => {
  const plans = [...getPlans()].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.json({
    success: true,
    plans,
    durationOptions: DURATION_MONTH_OPTIONS,
    byokSalesEnabled: getByokSalesEnabled(),
    freeTrialEnabled: getFreeTrialEnabled(),
    freeTrialDays: getFreeTrialDays()
  });
});

router.post('/plans', authMiddleware, subAdminOrAdmin, async (req, res) => {
  const newPlan = normalizePlan({
    ...req.body,
    id: `plan_${Date.now()}`
  });
  const next = [...getPlans(), newPlan];
  setPlans(next);
  try {
    await persistPlans();
  } catch {
    /* in-memory still works */
  }
  res.status(201).json({ success: true, message: 'Plan created successfully', plan: newPlan });
});

router.put('/plans/:id', authMiddleware, subAdminOrAdmin, async (req, res) => {
  const { id } = req.params;
  const plans = getPlans();
  const idx = plans.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Plan not found' });

  const merged = normalizePlan({
    ...plans[idx],
    ...req.body,
    id
  });
  const next = [...plans];
  next[idx] = merged;
  setPlans(next);
  try {
    await persistPlans();
  } catch {
    /* ignore */
  }
  res.json({ success: true, message: 'Plan updated', plan: merged });
});

router.delete('/plans/:id', authMiddleware, subAdminOrAdmin, async (req, res) => {
  const { id } = req.params;
  setPlans(getPlans().filter((p) => p.id !== id));
  try {
    await persistPlans();
  } catch {
    /* ignore */
  }
  res.json({ success: true, message: 'Plan deleted' });
});

// ================= BYOK PLATFORM TOGGLE =================

router.get('/settings/byok', authMiddleware, subAdminOrAdmin, (req, res) => {
  res.json({
    success: true,
    byokSalesEnabled: getByokSalesEnabled(),
    note: 'Turning OFF hides BYOK plans for new buyers. Existing BYOK members keep access.'
  });
});

router.post('/settings/byok', authMiddleware, adminOnly, async (req, res) => {
  try {
    const enabled =
      req.body.byokSalesEnabled !== undefined
        ? !!req.body.byokSalesEnabled
        : !!req.body.enabled;
    setByokSalesEnabled(enabled);
    try {
      await persistByokSettings();
    } catch {
      /* in-memory still works */
    }
    res.json({
      success: true,
      message: enabled
        ? 'BYOK membership sales are ON — new users can buy BYOK plans.'
        : 'BYOK membership sales are OFF — existing BYOK users keep access; new BYOK purchases blocked.',
      byokSalesEnabled: getByokSalesEnabled()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// ================= FREE TRIAL TOGGLE (default OFF) =================

router.get('/settings/free-trial', authMiddleware, subAdminOrAdmin, (req, res) => {
  res.json({
    success: true,
    freeTrialEnabled: getFreeTrialEnabled(),
    freeTrialDays: getFreeTrialDays(),
    note: 'Default is OFF. When ON, only new signups get a trial. Existing users are unchanged.'
  });
});

router.get('/settings/payments', authMiddleware, subAdminOrAdmin, (req, res) => {
  res.json({
    success: true,
    ...getPaymentMethodsSettings(),
    utrPay: getUtrPayDetails(),
    note: 'Razorpay default OFF. UPI ID / payee / QR can be edited from admin (stored in DB; .env is fallback).'
  });
});

router.post('/settings/payments', authMiddleware, adminOnly, async (req, res) => {
  try {
    const current = getPaymentMethodsSettings();
    const next = setPaymentMethodsSettings({
      razorpayEnabled:
        req.body.razorpayEnabled !== undefined ? req.body.razorpayEnabled : current.razorpayEnabled,
      utrEnabled: req.body.utrEnabled !== undefined ? req.body.utrEnabled : current.utrEnabled,
      utrAutoApprove:
        req.body.utrAutoApprove !== undefined ? req.body.utrAutoApprove : current.utrAutoApprove
    });
    if (!next.razorpayEnabled && !next.utrEnabled) {
      // Keep at least one method on — revert last write in memory
      setPaymentMethodsSettings(current);
      return res.status(400).json({
        success: false,
        message: 'At least one payment method (Razorpay or UTR) must stay enabled.'
      });
    }
    try {
      await persistPaymentMethodsSettings();
    } catch {
      /* in-memory still works */
    }
    res.json({
      success: true,
      message: `Payment methods updated — Razorpay ${next.razorpayEnabled ? 'ON' : 'OFF'}, UTR ${
        next.utrEnabled ? 'ON' : 'OFF'
      }, UTR auto-approve ${next.utrAutoApprove ? 'ON' : 'OFF'}.`,
      ...next,
      utrPay: getUtrPayDetails()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Super Admin: edit UPI ID / payee / QR / instructions shown at checkout */
router.post('/settings/utr-config', authMiddleware, adminOnly, async (req, res) => {
  try {
    const next = setUtrPayDetails({
      upiId: req.body.upiId,
      payeeName: req.body.payeeName,
      qrImageUrl: req.body.qrImageUrl,
      instructions: req.body.instructions
    });
    if (!next.upiId) {
      return res.status(400).json({
        success: false,
        message: 'UPI ID is required for UTR checkout (e.g. name@okhdfcbank).'
      });
    }
    try {
      await persistUtrPayDetails();
    } catch {
      /* in-memory still works */
    }
    res.json({
      success: true,
      message: 'UTR / UPI checkout details saved. Users will see the new UPI ID at checkout.',
      utrPay: next
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * Super Admin: upload UPI QR image (PNG/JPG/WEBP, max ~4MB).
 * Body: { imageBase64: "data:image/png;base64,..." } OR { imageBase64, mimeType }
 */
router.post('/settings/utr-qr-upload', authMiddleware, adminOnly, async (req, res) => {
  try {
    const raw = String(req.body?.imageBase64 || '').trim();
    if (!raw) {
      return res.status(400).json({ success: false, message: 'imageBase64 is required.' });
    }

    let mime = String(req.body?.mimeType || '').trim().toLowerCase();
    let b64 = raw;
    const dataUrlMatch = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (dataUrlMatch) {
      mime = dataUrlMatch[1].toLowerCase();
      b64 = dataUrlMatch[2];
    }
    const ext = UTR_QR_MIME[mime];
    if (!ext) {
      return res.status(400).json({
        success: false,
        message: 'Only PNG, JPG, or WEBP images are allowed for UPI QR.'
      });
    }

    const buffer = Buffer.from(b64, 'base64');
    if (!buffer.length) {
      return res.status(400).json({ success: false, message: 'Invalid image data.' });
    }
    if (buffer.length > 4 * 1024 * 1024) {
      return res.status(400).json({ success: false, message: 'QR image must be under 4MB.' });
    }

    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
    // Remove previous utr-qr.* variants
    for (const oldExt of Object.values(UTR_QR_MIME)) {
      const oldPath = path.join(UPLOADS_DIR, `utr-qr.${oldExt}`);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch {
          /* ignore */
        }
      }
    }
    const filename = `utr-qr.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    fs.writeFileSync(filePath, buffer);

    const qrImageUrl = `${publicBaseFromReq(req)}/uploads/${filename}?v=${Date.now()}`;
    const next = setUtrPayDetails({ qrImageUrl });
    try {
      await persistUtrPayDetails();
    } catch {
      /* in-memory still works */
    }

    res.json({
      success: true,
      message: 'UPI QR uploaded. Checkout will show this QR.',
      qrImageUrl,
      utrPay: next
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/settings/free-trial', authMiddleware, adminOnly, async (req, res) => {
  try {
    const enabled =
      req.body.freeTrialEnabled !== undefined
        ? !!req.body.freeTrialEnabled
        : req.body.enabled !== undefined
          ? !!req.body.enabled
          : getFreeTrialEnabled();
    const days =
      req.body.freeTrialDays !== undefined ? req.body.freeTrialDays : req.body.days;
    setFreeTrialSettings({ enabled, days });
    try {
      await persistFreeTrialSettings();
    } catch {
      /* in-memory still works */
    }
    const on = getFreeTrialEnabled();
    res.json({
      success: true,
      message: on
        ? `Free trial ON for new signups (${getFreeTrialDays()} days).`
        : 'Free trial OFF — new signups get no trial access until they buy a plan.',
      freeTrialEnabled: on,
      freeTrialDays: getFreeTrialDays()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** Public: signup / pricing pages can show whether trial is offered */
router.get('/public-signup-settings', (_req, res) => {
  res.json({
    success: true,
    freeTrialEnabled: getFreeTrialEnabled(),
    freeTrialDays: getFreeTrialDays(),
    byokSalesEnabled: getByokSalesEnabled()
  });
});

// ================= BROKER & ANNOUNCEMENTS =================

router.post('/settings/broker', authMiddleware, adminOnly, (req, res) => {
  const { brokerProvider, dhanConfig } = req.body;
  if (brokerProvider) systemSettings.brokerProvider = brokerProvider;
  if (dhanConfig) {
    const next = { ...systemSettings.dhanConfig, ...dhanConfig };
    // Ignore masked placeholder submissions so we don't wipe a real token
    if (typeof next.accessToken === 'string' && next.accessToken.includes('•')) {
      next.accessToken = systemSettings.dhanConfig.accessToken;
    }
    systemSettings.dhanConfig = next;
  }
  res.json({
    success: true,
    message: 'Broker settings saved',
    settings: maskBrokerSettings(systemSettings)
  });
});

router.post('/settings/announcement', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { announcement, announcementEnabled } = req.body;
  if (announcement !== undefined) systemSettings.announcement = announcement;
  if (announcementEnabled !== undefined) systemSettings.announcementEnabled = announcementEnabled;
  res.json({ success: true, message: 'Announcement updated', settings: systemSettings });
});

// ================= SMTP EMAIL =================

router.get('/settings/smtp', authMiddleware, adminOnly, (req, res) => {
  res.json({
    success: true,
    smtp: getPublicSmtpSettings(),
    ready: isSmtpReady()
  });
});

router.post('/settings/smtp', authMiddleware, adminOnly, async (req, res) => {
  try {
    const {
      enabled,
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail
    } = req.body || {};

    if (host !== undefined && !String(host || '').trim()) {
      return res.status(400).json({ success: false, message: 'SMTP host is required.' });
    }
    if (fromEmail !== undefined && String(fromEmail || '').trim() && !String(fromEmail).includes('@')) {
      return res.status(400).json({ success: false, message: 'From email looks invalid.' });
    }

    setSmtpSettings({
      enabled,
      host,
      port,
      secure,
      user,
      pass,
      fromName,
      fromEmail
    });
    await persistSmtpSettings();

    res.json({
      success: true,
      message: 'SMTP settings saved.',
      smtp: getPublicSmtpSettings(),
      ready: isSmtpReady()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Could not save SMTP settings.' });
  }
});

router.post('/settings/smtp/test', authMiddleware, adminOnly, async (req, res) => {
  try {
    const to = String(req.body?.to || req.user?.email || '')
      .trim()
      .toLowerCase();
    if (!to || !to.includes('@')) {
      return res.status(400).json({ success: false, message: 'Enter a valid test recipient email.' });
    }
    if (!isSmtpReady()) {
      return res.status(400).json({
        success: false,
        message: 'Save SMTP host, user, password, and from-email first (and enable SMTP).'
      });
    }
    await sendTestSmtpEmail(to);
    res.json({
      success: true,
      message: `Test email sent to ${to}. Check inbox (and spam).`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: err.message || 'SMTP test failed. Check host/port/credentials.'
    });
  }
});

// Email templates (signup / forgot password / 2FA / test)
router.get('/settings/email-templates', authMiddleware, adminOnly, (req, res) => {
  res.json({
    success: true,
    templates: getEmailTemplatesPublic(),
    variables: getTemplateVariableHelp(),
    smtp: getPublicSmtpSettings(),
    ready: isSmtpReady()
  });
});

router.put('/settings/email-templates/:key', authMiddleware, adminOnly, async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const { subject, html, text, enabled } = req.body || {};
    if (subject !== undefined && !String(subject || '').trim()) {
      return res.status(400).json({ success: false, message: 'Subject is required.' });
    }
    if (html !== undefined && !String(html || '').trim()) {
      return res.status(400).json({ success: false, message: 'HTML body is required.' });
    }

    const saved = setEmailTemplate(key, { subject, html, text, enabled });
    await persistEmailTemplates();

    res.json({
      success: true,
      message: `Template "${key}" saved.`,
      template: {
        ...saved,
        ...(getEmailTemplatesPublic().find((t) => t.key === key) || {})
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Could not save template.' });
  }
});

router.post('/settings/email-templates/:key/reset', authMiddleware, adminOnly, async (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const saved = resetEmailTemplate(key);
    await persistEmailTemplates();
    res.json({
      success: true,
      message: `Template "${key}" reset to default.`,
      template: {
        ...saved,
        ...(getEmailTemplatesPublic().find((t) => t.key === key) || {})
      }
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Could not reset template.' });
  }
});

router.post('/settings/email-templates/:key/preview', authMiddleware, adminOnly, (req, res) => {
  try {
    const key = String(req.params.key || '').trim();
    const list = getEmailTemplatesPublic();
    const tpl = list.find((t) => t.key === key);
    if (!tpl) {
      return res.status(404).json({ success: false, message: 'Template not found.' });
    }
    const sample = {
      otp: '482917',
      name: 'Yashvardhan',
      email: 'demo@tradrift.in',
      expiresMinutes: '10',
      brand: getPublicSmtpSettings().fromName || 'Tradrift',
      year: String(new Date().getFullYear()),
      purpose: tpl.purpose || key
    };
    res.json({
      success: true,
      subject: renderTemplateString(tpl.subject, sample),
      html: renderTemplateString(tpl.html, sample),
      text: renderTemplateString(tpl.text, sample),
      sample
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message || 'Preview failed.' });
  }
});

router.get('/public-announcement', (req, res) => {
  res.json({
    success: true,
    enabled: systemSettings.announcementEnabled,
    announcement: systemSettings.announcement
  });
});

router.get('/public-social', (_req, res) => {
  res.json({
    success: true,
    social: getPublicSocialMedia()
  });
});

router.get('/settings/social', authMiddleware, subAdminOrAdmin, (_req, res) => {
  res.json({
    success: true,
    platforms: getSocialMediaAdmin()
  });
});

router.post('/settings/social', authMiddleware, adminOnly, async (req, res) => {
  try {
    const platforms = Array.isArray(req.body?.platforms) ? req.body.platforms : null;
    if (!platforms) {
      return res.status(400).json({ success: false, message: 'platforms array is required.' });
    }
    for (const row of platforms) {
      const url = String(row?.url || '').trim();
      if (row?.enabled && url && !/^https?:\/\//i.test(url)) {
        return res.status(400).json({
          success: false,
          message: `${row.label || row.key}: URL must start with http:// or https://`
        });
      }
    }
    setSocialMediaSettings({ platforms });
    await persistSocialMediaSettings();
    res.json({
      success: true,
      message: 'Social media settings saved.',
      platforms: getSocialMediaAdmin()
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Could not save social settings.' });
  }
});

// ================= OPENING 5-MINUTE MOMENTUM SCANNER ADMIN =================

// Get Opening Momentum Scanner settings & stats
router.get('/opening-momentum/settings', authMiddleware, subAdminOrAdmin, (req, res) => {
  try {
    const settings = openingMomentumService.getSettings();
    const liveData = openingMomentumService.getLiveRankings(marketDataService.stocks);
    res.json({
      success: true,
      settings,
      stats: liveData.stats || {},
      gainersCount: liveData.gainers?.length || 0,
      losersCount: liveData.losers?.length || 0
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Update Opening Momentum Scanner settings
router.put('/opening-momentum/settings', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const updated = await openingMomentumService.updateSettings(req.body);
    res.json({ success: true, message: 'Opening Momentum Scanner settings updated', settings: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Force trigger 09:20 Reference Price Freeze (for live testing & verification)
router.post('/opening-momentum/trigger-freeze', authMiddleware, subAdminOrAdmin, (req, res) => {
  try {
    const result = openingMomentumService.forceTriggerFreeze(marketDataService.stocks);
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Reset session
router.post('/opening-momentum/reset', authMiddleware, subAdminOrAdmin, (req, res) => {
  try {
    const result = openingMomentumService.resetSession(marketDataService.stocks);
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Manually archive today's (or current freeze) EOD momentum snapshot
router.post('/opening-momentum/archive', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const force = !!req.body?.force;
    const result = await openingMomentumService.archiveSession(marketDataService.stocks, {
      force,
      source: 'admin'
    });
    if (!result.success) {
      return res.status(409).json(result);
    }
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// List / fetch archived snapshots (admin)
router.get('/opening-momentum/history/dates', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const dates = await openingMomentumService.listHistoryDates(req.query.limit || 60);
    res.json({ success: true, dates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/opening-momentum/history/:date', authMiddleware, subAdminOrAdmin, async (req, res) => {
  try {
    const date = String(req.params.date || '');
    const doc = await openingMomentumService.getHistorySnapshot(date);
    if (!doc) {
      return res.status(404).json({ success: false, message: `No archive for ${date}` });
    }
    res.json({ success: true, data: openingMomentumService.formatHistoryPayload(doc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
