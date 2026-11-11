import express from 'express';
import { marketDataService } from '../services/marketDataService.js';

const router = express.Router();

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
