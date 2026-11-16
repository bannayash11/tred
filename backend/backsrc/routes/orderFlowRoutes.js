import express from 'express';
import zlib from 'zlib';
import {
  authMiddleware,
  requireActiveSubscription,
  subAdminOrAdmin
} from '../middleware/authMiddleware.js';
import { orderFlowService } from '../services/orderFlowService.js';
import { byokOrderFlowRuntime } from '../services/byokOrderFlowRuntime.js';
import { classifyUserFeedMode } from '../services/byokSessionService.js';

const router = express.Router();

function sendCompressedJson(req, res, jsonStringOrBuffer) {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const buffer = Buffer.isBuffer(jsonStringOrBuffer)
    ? jsonStringOrBuffer
    : Buffer.from(jsonStringOrBuffer, 'utf8');

  if (acceptEncoding.includes('gzip')) {
    zlib.gzip(buffer, (err, gzipped) => {
      if (err) {
        res.type('application/json').send(buffer);
      } else {
        res.set({
          'Content-Type': 'application/json',
          'Content-Encoding': 'gzip',
          'Vary': 'Accept-Encoding'
        });
        res.send(gzipped);
      }
    });
  } else {
    res.type('application/json').send(buffer);
  }
}

router.use(authMiddleware, requireActiveSubscription);

router.get('/status', async (req, res) => {
  try {
    const ctx = await byokOrderFlowRuntime.resolve(req.user);
    const status = byokOrderFlowRuntime.getStatus(ctx);
    if (!status.ready && status.lastError) {
      return res.status(503).json(status);
    }
    res.json(status);
  } catch (err) {
    const code = err.statusCode || 500;
    res.status(code).json({ error: err.message, feed: err.feed || null });
  }
});

router.get('/universe', async (req, res) => {
  try {
    // Universe list is shared; feed tag reflects user mode
    const mode = classifyUserFeedMode(req.user);
    res.json({
      underlyings: orderFlowService.getUniverse(),
      feedMode: mode
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/market', async (req, res) => {
  try {
    const ctx = await byokOrderFlowRuntime.resolve(req.user);
    if (ctx.mode === 'byok' && ctx.handle && !ctx.handle.ready && ctx.handle.lastError) {
      return res.status(503).json({
        error: ctx.handle.lastError.message,
        feed: ctx.feed,
        retryAfter: 10
      });
    }
    // Shared board file for now; BYOK Upstox users still get feed tag via status.
    // Per-user OF board rebuild is rate-limit heavy — status/futures use user token.
    const json = orderFlowService.getMarketJson();
    if (!json) {
      const status = orderFlowService.getStatus();
      return res.status(503).json({
        error: status.lastError?.message || 'The first market file is still being built.',
        feed: ctx.feed,
        retryAfter: 5
      });
    }
    sendCompressedJson(req, res, json);
  } catch (err) {
    const code = err.statusCode || 500;
    res.status(code).json({ error: err.message, feed: err.feed || null });
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
    sendCompressedJson(req, res, body);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/futures-bundle', async (req, res) => {
  try {
    const session =
      req.query.session ||
      orderFlowService.getStatus().session;
    const payload = orderFlowService.getFuturesBundle(session);
    sendCompressedJson(req, res, JSON.stringify(payload));
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
