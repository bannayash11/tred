import express from 'express';
import { authMiddleware, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { openingMomentumService } from '../services/openingMomentumService.js';
import { byokMarketRuntime } from '../services/byokMarketRuntime.js';
import {
  applyScreenerPlanLimits,
  resolveUserEntitlements
} from '../services/membershipPlans.js';

const router = express.Router();

router.use(authMiddleware, requireActiveSubscription);

function sendByokError(res, err) {
  const status = err.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: err.message,
    feed: err.feed || null,
    needsReconnect: !!err.needsReconnect
  });
}

function entitlementsOr403(req, res, { needTerminal = false, needXRay = false } = {}) {
  if (req.user?.role === 'admin' || req.user?.role === 'subadmin') {
    return {
      maxStocks: 9999,
      timeframesAllowed: ['1m', '3m', '5m', '15m', '1h', '1d'],
      allowTerminal: true,
      allowMarketXRay: true
    };
  }
  const entitlements = resolveUserEntitlements(req.user);
  if (needTerminal && !entitlements.allowTerminal) {
    res.status(403).json({
      success: false,
      message: 'Your plan does not include Terminal access.'
    });
    return null;
  }
  if (needXRay && !entitlements.allowMarketXRay) {
    res.status(403).json({
      success: false,
      message: 'Your plan does not include Market X-Ray.'
    });
    return null;
  }
  return entitlements;
}

// Get live ranked Order Block screener setups
router.get('/live', async (req, res) => {
  try {
    const entitlements = entitlementsOr403(req, res, { needTerminal: true });
    if (!entitlements) return;
    const { data, feed } = await byokMarketRuntime.getScreenerForUser(req.user);
    res.json({
      success: true,
      data: applyScreenerPlanLimits(data, entitlements),
      feed,
      entitlements: {
        maxStocks: entitlements.maxStocks,
        timeframesAllowed: entitlements.timeframesAllowed
      }
    });
  } catch (err) {
    sendByokError(res, err);
  }
});

// Get Market X-Ray macro statistics
router.get('/market-xray', async (req, res) => {
  try {
    const entitlements = entitlementsOr403(req, res, { needXRay: true });
    if (!entitlements) return;
    const { data, feed } = await byokMarketRuntime.getMarketXRayForUser(req.user);
    res.json({ success: true, data, feed });
  } catch (err) {
    sendByokError(res, err);
  }
});

// Market Analyse report — bias + fixed pivot / S-R levels
router.get('/market-analyse', async (req, res) => {
  try {
    const entitlements = entitlementsOr403(req, res, { needXRay: true });
    if (!entitlements) return;
    const timeframe = String(req.query.tf || req.query.timeframe || '5m').toLowerCase();
    const rangeDays = Number(req.query.range || req.query.rangeDays || 10);
    const { data, feed } = await byokMarketRuntime.getMarketAnalysisForUser(req.user, {
      timeframe,
      rangeDays
    });
    res.json({ success: true, data, feed });
  } catch (err) {
    sendByokError(res, err);
  }
});

// Get Opening 5-Minute Momentum Scanner data
router.get('/opening-momentum', async (req, res) => {
  try {
    const { data, feed } = await byokMarketRuntime.getOpeningMomentumForUser(req.user);
    res.json({ success: true, data, feed });
  } catch (err) {
    sendByokError(res, err);
  }
});

// List archived EOD momentum session dates (for next-day preview)
router.get('/opening-momentum/history/dates', async (req, res) => {
  try {
    const dates = await openingMomentumService.listHistoryDates(req.query.limit);
    res.json({ success: true, dates });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Latest archived EOD snapshot
router.get('/opening-momentum/history/latest', async (req, res) => {
  try {
    const doc = await openingMomentumService.getLatestHistorySnapshot();
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: 'No archived momentum session yet. Data is saved automatically after market close.'
      });
    }
    res.json({ success: true, data: openingMomentumService.formatHistoryPayload(doc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Archived EOD snapshot by date (YYYY-MM-DD)
router.get('/opening-momentum/history/:date', async (req, res) => {
  try {
    const date = String(req.params.date || '');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({ success: false, message: 'Invalid date. Use YYYY-MM-DD.' });
    }
    const doc = await openingMomentumService.getHistorySnapshot(date);
    if (!doc) {
      return res.status(404).json({
        success: false,
        message: `No momentum archive found for ${date}.`
      });
    }
    res.json({ success: true, data: openingMomentumService.formatHistoryPayload(doc) });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get detailed stock data with LIVE candles for chart (tf + range query params)
// Platform / server-plan only. BYOK charts load from the browser → broker.
router.get('/stock/:symbol', async (req, res) => {
  try {
    const entitlements = entitlementsOr403(req, res, { needTerminal: true });
    if (!entitlements) return;

    const { classifyUserFeedMode } = await import('../services/byokSessionService.js');
    if (classifyUserFeedMode(req.user) === 'byok') {
      return res.status(400).json({
        success: false,
        message:
          'BYOK charts load from your broker in the browser. Use /auth/byok/market-client — server chart feed is for platform plans only.',
        chartMode: 'client'
      });
    }
    const { symbol } = req.params;
    const timeframe = String(req.query.tf || req.query.timeframe || '5m').toLowerCase();
    if (!entitlements.timeframesAllowed.includes(timeframe)) {
      return res.status(403).json({
        success: false,
        message: `Timeframe ${timeframe} is not included in your plan.`,
        timeframesAllowed: entitlements.timeframesAllowed
      });
    }
    const rangeDays = Number(req.query.range || req.query.rangeDays || 30);
    const stock = await byokMarketRuntime.getStockDetailsForUser(req.user, symbol, {
      timeframe,
      rangeDays
    });
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock not found in universe.' });
    }
    res.json({ success: true, stock, feed: stock.feed || null });
  } catch (err) {
    sendByokError(res, err);
  }
});

export default router;
