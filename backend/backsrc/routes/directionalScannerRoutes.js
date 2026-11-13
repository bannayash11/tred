import express from 'express';
import { authMiddleware, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { marketDataService } from '../services/marketDataService.js';
import { directionalScannerService } from '../services/directionalScannerService.js';

const router = express.Router();

router.use(authMiddleware, requireActiveSubscription);

function parseOverrides(query = {}) {
  const overrides = {};
  if (query.topCount != null) overrides.topCount = Number(query.topCount);
  if (query.atrPeriod != null) overrides.atrPeriod = Number(query.atrPeriod);
  if (query.avgPeriod != null) overrides.avgPeriod = Number(query.avgPeriod);
  if (query.efficiencyLookback != null) overrides.efficiencyLookback = Number(query.efficiencyLookback);
  if (query.overlapLookback != null) overrides.overlapLookback = Number(query.overlapLookback);
  if (query.adxPeriod != null) overrides.adxPeriod = Number(query.adxPeriod);
  if (query.rejectEfficiencyBelow != null) {
    overrides.rejectEfficiencyBelow = Number(query.rejectEfficiencyBelow);
  }
  if (query.strongEfficiencyAbove != null) {
    overrides.strongEfficiencyAbove = Number(query.strongEfficiencyAbove);
  }
  if (query.lowActivityBelow != null) overrides.lowActivityBelow = Number(query.lowActivityBelow);
  return overrides;
}

// Live directional F&O scanner (new page) — does not alter /api/screener/*
router.get('/live', (req, res) => {
  try {
    const overrides = parseOverrides(req.query || {});
    const data = directionalScannerService.scan(marketDataService.stocks, overrides);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/settings', (_req, res) => {
  try {
    res.json({ success: true, data: directionalScannerService.getSettings() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
