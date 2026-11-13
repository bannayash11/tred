import express from 'express';
import { authMiddleware, requireActiveSubscription } from '../middleware/authMiddleware.js';
import { marketDataService } from '../services/marketDataService.js';
import { openingMomentumService } from '../services/openingMomentumService.js';

const router = express.Router();

router.use(authMiddleware, requireActiveSubscription);

// Get live ranked Order Block screener setups
router.get('/live', (req, res) => {
  try {
    const data = marketDataService.getScreenerData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Market X-Ray macro statistics
router.get('/market-xray', (req, res) => {
  try {
    const data = marketDataService.getMarketXRay();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Get Opening 5-Minute Momentum Scanner data
router.get('/opening-momentum', (req, res) => {
  try {
    const data = marketDataService.getOpeningMomentumData();
    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
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
router.get('/stock/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const timeframe = String(req.query.tf || req.query.timeframe || '5m').toLowerCase();
    const rangeDays = Number(req.query.range || req.query.rangeDays || 30);
    const stock = await marketDataService.getStockDetails(symbol, { timeframe, rangeDays });
    if (!stock) {
      return res.status(404).json({ success: false, message: 'Stock not found in universe.' });
    }
    res.json({ success: true, stock });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
