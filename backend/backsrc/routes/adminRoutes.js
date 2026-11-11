import express from 'express';
import { User } from '../models/User.js';
import { Settings } from '../models/Settings.js';
import { authMiddleware, adminOnly, subAdminOrAdmin } from '../middleware/authMiddleware.js';
import { marketDataService } from '../services/marketDataService.js';
import { openingMomentumService } from '../services/openingMomentumService.js';

const router = express.Router();

// Offline fallback only — starts empty (no demo traders)
let inMemoryUsers = [];

const DURATION_MONTH_OPTIONS = [1, 3, 6, 12];

const normalizePlan = (raw = {}) => {
  const durationMonths = DURATION_MONTH_OPTIONS.includes(Number(raw.durationMonths))
    ? Number(raw.durationMonths)
    : raw.durationDays === 14
      ? 0
      : Math.max(1, Math.round((Number(raw.durationDays) || 30) / 30));

  const durationDays =
    raw.durationDays !== undefined && raw.durationDays !== null
      ? Number(raw.durationDays)
      : durationMonths === 0
        ? 14
        : durationMonths * 30;

  const tfRaw = raw.timeframesAllowed || raw.timeframes || ['15m'];
  const timeframesAllowed = Array.isArray(tfRaw)
    ? tfRaw.map((t) => String(t).trim()).filter(Boolean)
    : String(tfRaw)
        .split(',')
        .map((t) => t.trim().replace(/ only$/i, ''))
        .filter(Boolean);

  return {
    id: raw.id || `plan_${Date.now()}`,
    name: raw.name || 'Untitled Plan',
    price: Number(raw.price) || 0,
    durationMonths,
    durationDays,
    badge: raw.badge || 'Plan',
    featured: !!raw.featured,
    enabled: raw.enabled !== false,
    sortOrder: Number(raw.sortOrder) || 0,
    maxStocks: Number(raw.maxStocks ?? raw.maxStocksVisible) || 30,
    timeframes: timeframesAllowed.join(', '),
    timeframesAllowed,
    maxJournal: Number(raw.maxJournal ?? raw.maxTradeLog) || 30,
    maxTradeLog: Number(raw.maxTradeLog ?? raw.maxJournal) || 30,
    allowTerminal: raw.allowTerminal !== false,
    allowMarketXRay: raw.allowMarketXRay !== false,
    allowTradeLog: raw.allowTradeLog !== false,
    allowFullFVG: raw.allowFullFVG !== false,
    description: raw.description || ''
  };
};

let inMemoryPlans = [
  normalizePlan({
    id: 'plan_1m',
    name: '1 Month Access',
    price: 1999,
    durationMonths: 1,
    badge: 'Monthly',
    maxStocks: 30,
    timeframesAllowed: ['5m', '15m'],
    maxTradeLog: 30,
    allowTerminal: true,
    allowMarketXRay: true,
    allowTradeLog: true,
    allowFullFVG: true,
    enabled: true,
    sortOrder: 1,
    description: 'Full terminal access for 1 month'
  }),
  normalizePlan({
    id: 'plan_3m',
    name: '3 Months Access',
    price: 4999,
    durationMonths: 3,
    badge: 'Popular',
    featured: true,
    maxStocks: 100,
    timeframesAllowed: ['1m', '5m', '15m'],
    maxTradeLog: 200,
    allowTerminal: true,
    allowMarketXRay: true,
    allowTradeLog: true,
    allowFullFVG: true,
    enabled: true,
    sortOrder: 2,
    description: 'Best value quarterly membership'
  }),
  normalizePlan({
    id: 'plan_6m',
    name: '6 Months Access',
    price: 7999,
    durationMonths: 6,
    badge: 'Pro',
    maxStocks: 200,
    timeframesAllowed: ['1m', '5m', '15m'],
    maxTradeLog: 9999,
    allowTerminal: true,
    allowMarketXRay: true,
    allowTradeLog: true,
    allowFullFVG: true,
    enabled: true,
    sortOrder: 3,
    description: 'Half-year institutional access'
  }),
  normalizePlan({
    id: 'plan_12m',
    name: '12 Months Access',
    price: 12999,
    durationMonths: 12,
    badge: 'Flagship',
    featured: true,
    maxStocks: 200,
    timeframesAllowed: ['1m', '5m', '15m'],
    maxTradeLog: 9999,
    allowTerminal: true,
    allowMarketXRay: true,
    allowTradeLog: true,
    allowFullFVG: true,
    enabled: true,
    sortOrder: 4,
    description: 'Full year unlimited institutional terminal'
  })
];

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
      users = inMemoryUsers;
    }

    const totalUsers = users.length;
    const activeSubscribers = users.filter(u => u.subscription?.status === 'active').length;
    const trialUsers = users.filter(u => u.subscription?.status === 'trial').length;
    const estimatedMRR = activeSubscribers * 1250;

    res.json({
      success: true,
      stats: { totalUsers, activeSubscribers, trialUsers, estimatedMRR },
      users,
      plans: inMemoryPlans,
      settings: systemSettings
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

    const expiresAt = new Date(Date.now() + (durationDays || 30) * 24 * 3600 * 1000);
    const newUser = {
      _id: `usr_${Date.now()}`,
      name,
      email,
      role: safeRole,
      subscription: {
        status: status || 'trial',
        plan: plan || '14-Day Free Trial',
        expiresAt
      },
      createdAt: new Date()
    };

    try {
      const u = new User({ ...newUser, password: password || 'trader123' });
      await u.save();
    } catch {
      // In-memory fallback
      inMemoryUsers.unshift(newUser);
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
router.get('/public-plans', (req, res) => {
  const plans = inMemoryPlans
    .filter((p) => p.enabled !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.json({ success: true, plans });
});

router.get('/plans', authMiddleware, subAdminOrAdmin, (req, res) => {
  const plans = [...inMemoryPlans].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
  res.json({ success: true, plans, durationOptions: DURATION_MONTH_OPTIONS });
});

router.post('/plans', authMiddleware, subAdminOrAdmin, (req, res) => {
  const newPlan = normalizePlan({
    ...req.body,
    id: `plan_${Date.now()}`
  });
  inMemoryPlans.push(newPlan);
  res.status(201).json({ success: true, message: 'Plan created successfully', plan: newPlan });
});

router.put('/plans/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  const idx = inMemoryPlans.findIndex((p) => p.id === id);
  if (idx === -1) return res.status(404).json({ success: false, message: 'Plan not found' });

  const merged = normalizePlan({
    ...inMemoryPlans[idx],
    ...req.body,
    id
  });
  inMemoryPlans[idx] = merged;
  res.json({ success: true, message: 'Plan updated', plan: merged });
});

router.delete('/plans/:id', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { id } = req.params;
  inMemoryPlans = inMemoryPlans.filter((p) => p.id !== id);
  res.json({ success: true, message: 'Plan deleted' });
});

// ================= BROKER & ANNOUNCEMENTS =================

router.post('/settings/broker', authMiddleware, adminOnly, (req, res) => {
  const { brokerProvider, dhanConfig } = req.body;
  if (brokerProvider) systemSettings.brokerProvider = brokerProvider;
  if (dhanConfig) systemSettings.dhanConfig = { ...systemSettings.dhanConfig, ...dhanConfig };
  res.json({ success: true, message: 'Broker settings saved', settings: systemSettings });
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
