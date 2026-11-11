import mongoose from 'mongoose';

const tradeJournalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  symbol: {
    type: String,
    required: true,
    uppercase: true
  },
  direction: {
    type: String,
    enum: ['BUY', 'SELL'],
    required: true
  },
  setupType: {
    type: String,
    enum: ['ORDER_BLOCK', 'FVG', 'LIQUIDITY_SWEEP', 'BREAKOUT', 'REVERSAL'],
    default: 'ORDER_BLOCK'
  },
  timeframe: {
    type: String,
    default: '5m'
  },
  entryPrice: {
    type: Number,
    required: true
  },
  exitPrice: {
    type: Number
  },
  stopLoss: {
    type: Number,
    required: true
  },
  targetPrice: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    default: 1
  },
  status: {
    type: String,
    enum: ['OPEN', 'TARGET_HIT', 'SL_HIT', 'CLOSED'],
    default: 'OPEN'
  },
  pnl: {
    type: Number,
    default: 0
  },
  riskReward: {
    type: Number
  },
  notes: {
    type: String,
    default: ''
  },
  tradeDate: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

export const TradeJournal = mongoose.model('TradeJournal', tradeJournalSchema);
