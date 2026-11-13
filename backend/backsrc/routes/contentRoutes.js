import express from 'express';
import { authMiddleware, subAdminOrAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();

// Tier Feature Rules Configuration (plans may override; this is a fallback catalog)
let tierFeatureRules = {
  trial: {
    name: '14-Day Free Trial',
    maxStocksVisible: 8,
    timeframesAllowed: ['15m'],
    allowMarketXRay: true,
    allowFullFVG: false
  },
  starter: {
    name: 'Monthly Starter',
    maxStocksVisible: 30,
    timeframesAllowed: ['5m', '15m'],
    allowMarketXRay: true,
    allowFullFVG: true
  },
  active: {
    name: '12 Months Pro Bundle',
    maxStocksVisible: 200,
    timeframesAllowed: ['1m', '5m', '15m'],
    allowMarketXRay: true,
    allowFullFVG: true
  }
};

router.get('/tier-rules', (req, res) => {
  res.json({ success: true, rules: tierFeatureRules });
});

router.post('/tier-rules', authMiddleware, subAdminOrAdmin, (req, res) => {
  const { rules } = req.body;
  if (rules) {
    tierFeatureRules = { ...tierFeatureRules, ...rules };
  }
  res.json({ success: true, message: 'Membership tier feature rules updated', rules: tierFeatureRules });
});

export default router;
