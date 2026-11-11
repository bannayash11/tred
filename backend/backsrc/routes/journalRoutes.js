import express from 'express';
import { TradeJournal } from '../models/TradeJournal.js';
import { authMiddleware } from '../middleware/authMiddleware.js';

const router = express.Router();

let inMemoryTrades = [];

const userIdOf = (user) => String(user._id || user.id);

// Get user trades & performance summary
router.get('/', authMiddleware, async (req, res) => {
  try {
    const uid = userIdOf(req.user);
    let trades = [];
    try {
      trades = await TradeJournal.find({ userId: uid }).sort({ tradeDate: -1 });
    } catch {
      trades = inMemoryTrades.filter((t) => String(t.userId) === uid);
    }

    const totalTrades = trades.length;
    const winningTrades = trades.filter((t) => t.pnl > 0).length;
    const losingTrades = trades.filter((t) => t.pnl < 0).length;
    const winRate = totalTrades > 0 ? parseFloat(((winningTrades / totalTrades) * 100).toFixed(1)) : 0;
    const totalPnL = parseFloat(trades.reduce((sum, t) => sum + (t.pnl || 0), 0).toFixed(2));
    const avgRR =
      totalTrades > 0
        ? parseFloat((trades.reduce((sum, t) => sum + (t.riskReward || 1.5), 0) / totalTrades).toFixed(2))
        : 0;

    res.json({
      success: true,
      trades,
      stats: {
        totalTrades,
        winningTrades,
        losingTrades,
        winRate,
        totalPnL,
        avgRR
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Add new trade
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      symbol,
      direction,
      setupType,
      timeframe,
      entryPrice,
      stopLoss,
      targetPrice,
      exitPrice,
      quantity,
      status,
      notes
    } = req.body;

    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(targetPrice - entryPrice);
    const riskReward = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : 1.0;

    let pnl = 0;
    if (exitPrice) {
      pnl =
        direction === 'BUY'
          ? (exitPrice - entryPrice) * (quantity || 1)
          : (entryPrice - exitPrice) * (quantity || 1);
    }

    const tradeData = {
      userId: userIdOf(req.user),
      symbol,
      direction,
      setupType: setupType || 'ORDER_BLOCK',
      timeframe: timeframe || '5m',
      entryPrice: Number(entryPrice),
      stopLoss: Number(stopLoss),
      targetPrice: Number(targetPrice),
      exitPrice: exitPrice ? Number(exitPrice) : null,
      quantity: Number(quantity) || 1,
      status: status || 'OPEN',
      pnl: parseFloat(pnl.toFixed(2)),
      riskReward,
      notes: notes || '',
      tradeDate: new Date()
    };

    try {
      const newTrade = new TradeJournal(tradeData);
      await newTrade.save();
      return res.status(201).json({ success: true, trade: newTrade });
    } catch {
      const fallbackTrade = { _id: `jrn_${Date.now()}`, ...tradeData };
      inMemoryTrades.unshift(fallbackTrade);
      return res.status(201).json({ success: true, trade: fallbackTrade });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Delete trade (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const uid = userIdOf(req.user);

    try {
      const trade = await TradeJournal.findById(id);
      if (trade) {
        if (String(trade.userId) !== uid) {
          return res.status(403).json({ success: false, message: 'You can only delete your own trades.' });
        }
        await TradeJournal.findByIdAndDelete(id);
        return res.json({ success: true, message: 'Trade removed successfully.' });
      }
    } catch {
      // fall through to in-memory
    }

    const memTrade = inMemoryTrades.find((t) => String(t._id) === String(id));
    if (!memTrade) {
      return res.status(404).json({ success: false, message: 'Trade not found.' });
    }
    if (String(memTrade.userId) !== uid) {
      return res.status(403).json({ success: false, message: 'You can only delete your own trades.' });
    }

    inMemoryTrades = inMemoryTrades.filter((t) => String(t._id) !== String(id));
    res.json({ success: true, message: 'Trade removed successfully.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
