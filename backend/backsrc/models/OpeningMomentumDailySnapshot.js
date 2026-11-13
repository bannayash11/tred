import mongoose from 'mongoose';

const moverSchema = new mongoose.Schema(
  {
    rank: Number,
    symbol: { type: String, required: true },
    name: String,
    sector: String,
    ltp: Number,
    refClose: Number,
    high5m: Number,
    low5m: Number,
    movementPercent: Number,
    pointsChange: Number,
    rvol: Number,
    volume: Number,
    status: String,
    statusLabel: String,
    vwap: Number,
    vwapBias: String,
    direction: String,
    // EOD enrichment (same as live LTP at archive time)
    closeLtp: Number,
    closeMovementPercent: Number,
    closePointsChange: Number,
    // Simulated: long gainers / short losers from 09:20 → close
    simPnlPercent: Number,
    simPnlPoints: Number,
    result: { type: String, enum: ['PROFIT', 'LOSS', 'FLAT'] }
  },
  { _id: false }
);

const openingMomentumDailySnapshotSchema = new mongoose.Schema(
  {
    sessionDate: {
      type: String,
      required: true,
      unique: true,
      index: true,
      match: /^\d{4}-\d{2}-\d{2}$/
    },
    frozenAt: Date,
    freezeTime: { type: String, default: '09:20' },
    topCount: Number,
    minRvol: Number,
    breakoutOnly: Boolean,
    gainers: [moverSchema],
    losers: [moverSchema],
    breadth: { type: mongoose.Schema.Types.Mixed },
    stats: { type: mongoose.Schema.Types.Mixed },
    source: {
      type: String,
      enum: ['auto_eod', 'admin'],
      default: 'auto_eod'
    },
    savedAt: { type: Date, default: Date.now }
  },
  {
    timestamps: true,
    collection: 'opening_momentum_daily_snapshots'
  }
);

export const OpeningMomentumDailySnapshot = mongoose.model(
  'OpeningMomentumDailySnapshot',
  openingMomentumDailySnapshotSchema
);
