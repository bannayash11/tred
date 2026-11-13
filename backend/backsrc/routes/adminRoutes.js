import express from 'express';
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
  buildSignupSubscription
} from '../services/membershipPlans.js';
import { getByokPublicStatus } from '../services/byokSessionService.js';

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
        freeTrialDays: getFreeTrialDays()
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

router.get('/public-announcement', (req, res) => {
  res.json({
    success: true,
    enabled: systemSettings.announcementEnabled,
    announcement: systemSettings.announcement
  });
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

export default router;
