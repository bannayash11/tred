import { createSlice } from '@reduxjs/toolkit';

const initialTrades = [
  {
    id: 'tr_01',
    symbol: 'RELIANCE',
    direction: 'BUY',
    entryPrice: 2715.50,
    exitPrice: 2758.20,
    stopLoss: 2698.00,
    targetPrice: 2760.00,
    quantity: 150,
    status: 'CLOSED',
    pnl: 6405.00,
    roi: 1.57,
    orderBlockType: 'Bullish Demand OB',
    notes: 'Entered on 15m mitigation of H4 institutional order block after liquidity sweep of previous day low.',
    date: '2026-11-04'
  },
  {
    id: 'tr_02',
    symbol: 'HDFCBANK',
    direction: 'BUY',
    entryPrice: 1742.00,
    exitPrice: 1768.40,
    stopLoss: 1730.00,
    targetPrice: 1770.00,
    quantity: 200,
    status: 'CLOSED',
    pnl: 5280.00,
    roi: 1.51,
    orderBlockType: 'FVG Rebalance + Bullish OB',
    notes: 'Filled Fair Value Gap at opening session with institutional buy imbalance confirmation.',
    date: '2026-11-04'
  },
  {
    id: 'tr_03',
    symbol: 'TATASTEEL',
    direction: 'SELL',
    entryPrice: 149.20,
    exitPrice: 150.80,
    stopLoss: 150.80,
    targetPrice: 144.00,
    quantity: 1000,
    status: 'CLOSED',
    pnl: -1600.00,
    roi: -1.07,
    orderBlockType: 'Bearish Supply Block',
    notes: 'Stopped out due to sudden metals rally following global stimulus news.',
    date: '2026-11-03'
  },
  {
    id: 'tr_04',
    symbol: 'INFY',
    direction: 'BUY',
    entryPrice: 1820.00,
    exitPrice: null,
    stopLoss: 1805.00,
    targetPrice: 1860.00,
    quantity: 100,
    status: 'OPEN',
    pnl: 1420.00,
    roi: 0.78,
    orderBlockType: 'Liquidity Sweep SSL + BOS',
    notes: 'Holding overnight. Clean break of structure on 1H chart with target at previous month high.',
    date: '2026-11-05'
  }
];

const calculateStatsFromTrades = (trades) => {
  const closed = trades.filter(t => t.status === 'CLOSED');
  const total = closed.length;
  const wins = closed.filter(t => t.pnl > 0).length;
  const losses = closed.filter(t => t.pnl < 0).length;
  const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
  const totalPnL = closed.reduce((acc, t) => acc + (t.pnl || 0), 0);
  const profitTrades = closed.filter(t => t.pnl > 0).map(t => t.pnl);
  const lossTrades = closed.filter(t => t.pnl < 0).map(t => Math.abs(t.pnl));
  const avgProfit = profitTrades.length ? profitTrades.reduce((a, b) => a + b, 0) / profitTrades.length : 0;
  const avgLoss = lossTrades.length ? lossTrades.reduce((a, b) => a + b, 0) / lossTrades.length : 1;
  const profitFactor = avgLoss > 0 ? (avgProfit / avgLoss).toFixed(2) : '3.40';

  return {
    totalTrades: trades.length,
    closedTrades: total,
    winRate,
    totalPnL,
    profitFactor,
    bestTrade: Math.max(...closed.map(t => t.pnl || 0), 0)
  };
};

const initialState = {
  trades: initialTrades,
  stats: calculateStatsFromTrades(initialTrades),
  loading: false
};

export const journalSlice = createSlice({
  name: 'journal',
  initialState,
  reducers: {
    addTrade: (state, action) => {
      const newTrade = {
        id: `tr_${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        ...action.payload
      };
      state.trades.unshift(newTrade);
      state.stats = calculateStatsFromTrades(state.trades);
    },
    updateTrade: (state, action) => {
      const idx = state.trades.findIndex(t => t.id === action.payload.id);
      if (idx !== -1) {
        state.trades[idx] = { ...state.trades[idx], ...action.payload };
        state.stats = calculateStatsFromTrades(state.trades);
      }
    },
    deleteTrade: (state, action) => {
      state.trades = state.trades.filter(t => t.id !== action.payload);
      state.stats = calculateStatsFromTrades(state.trades);
    }
  }
});

export const { addTrade, updateTrade, deleteTrade } = journalSlice.actions;
export default journalSlice.reducer;

