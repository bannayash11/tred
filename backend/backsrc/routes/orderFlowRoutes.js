import express from 'express';
import { authMiddleware, subAdminOrAdmin } from '../middleware/authMiddleware.js';
import { orderFlowService } from '../services/orderFlowService.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/status', (req, res) => {
  try {
    const status = orderFlowService.getStatus();
    if (!status.ready && status.lastError) {
      return res.status(503).json(status);
    }
    res.json(status);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/universe', (req, res) => {
  try {
    res.json({ underlyings: orderFlowService.getUniverse() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/market', (req, res) => {
  try {
    const json = orderFlowService.getMarketJson();
    if (!json) {
      const status = orderFlowService.getStatus();
      return res.status(503).json({
        error: status.lastError?.message || 'The first market file is still being built.',
        retryAfter: 5
      });
    }
    res.type('application/json').send(json);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/market/:date/:hhmm', (req, res) => {
  try {
    const { date, hhmm } = req.params;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{4}$/.test(hhmm)) {
      return res.status(400).json({ error: 'Bad date/minute.' });
    }
    const body = orderFlowService.getMinuteFile(date, hhmm);
    if (!body) return res.status(404).json({ error: 'No such minute.' });
    res.type('application/json').send(body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/futures/:symbol', async (req, res) => {
  try {
    const symbol = String(req.params.symbol || '').toUpperCase();
    const session =
      req.query.session ||
      orderFlowService.getStatus().session;
    const payload = await orderFlowService.getFutures(symbol, session);
    res.json(payload);
  } catch (err) {
    const code = err.statusCode || 502;
    res.status(code).json({
      error: err.statusCode ? err.message : 'Kotak did not answer for this underlying.'
    });
  }
});

router.post('/rebuild', subAdminOrAdmin, async (req, res) => {
  try {
    if (!orderFlowService.getStatus().ready) {
      return res.status(503).json({ error: 'Order Flow provider is not ready.' });
    }
    // Admin-only: traders only read shared /market — never trigger Kotak rebuild storms
    void orderFlowService.build();
    res.json({ ok: true, message: 'Rebuild started.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
