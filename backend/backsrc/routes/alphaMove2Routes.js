import express from 'express';
import { authMiddleware, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { marketDataService } from '../services/marketDataService.js';
import { alphaMove2Service } from '../services/alphaMove2Service.js';

const router = express.Router();

router.use(authMiddleware, requireActiveSubscription);

function parseOverrides(query = {}) {
  const overrides = {};
  if (query.topCount != null) overrides.topCount = Number(query.topCount);
  if (query.histSessions != null) overrides.histSessions = Number(query.histSessions);
  if (query.softMaxHistMove != null) overrides.softMaxHistMove = Number(query.softMaxHistMove);
  return overrides;
}

// AlphaMove 2 — maximum movement scanner (does not alter AlphaMove / directional-scanner)
router.get('/live', (req, res) => {
  try {
    const overrides = parseOverrides(req.query || {});
    const data = alphaMove2Service.scan(marketDataService.stocks, overrides);
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/settings', (_req, res) => {
  try {
    res.json({ success: true, data: alphaMove2Service.getSettings() });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
