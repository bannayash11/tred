import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  stocks: [],
  bullishSetups: [],
  bearishSetups: [],
  marketXRay: null,
  selectedStock: null,
  activeTimeframe: '15m',
  searchQuery: '',
  selectedSector: 'ALL',
  liveConnected: false,
  announcement: '🔴 Live Market Updates Active: High institutional volume detected in Nifty Banking & Auto sectors.',
  announcementVisible: true
};

export const screenerSlice = createSlice({
  name: 'screener',
  initialState,
  reducers: {
    setScreenerData: (state, action) => {
      const { bullish, bearish, all } = action.payload;
      if (bullish) state.bullishSetups = bullish;
      if (bearish) state.bearishSetups = bearish;
      if (all) state.stocks = all;
    },
    setMarketXRay: (state, action) => {
      state.marketXRay = action.payload;
    },
    updateLiveTick: (state, action) => {
      const tick = action.payload;
      const updateList = (list) =>
        list.map((item) => {
          if (item.symbol === tick.symbol) {
            return {
              ...item,
              price: tick.price,
              change: tick.change,
              changePercent: tick.changePercent,
              high: Math.max(item.high || 0, tick.high || 0),
              low: Math.min(item.low || 999999, tick.low || 999999)
            };
          }
          return item;
        });

      state.bullishSetups = updateList(state.bullishSetups);
      state.bearishSetups = updateList(state.bearishSetups);
      state.stocks = updateList(state.stocks);

      if (state.selectedStock && state.selectedStock.symbol === tick.symbol) {
        state.selectedStock = {
          ...state.selectedStock,
          price: tick.price,
          change: tick.change,
          changePercent: tick.changePercent
        };
      }
    },
    setSelectedStock: (state, action) => {
      state.selectedStock = action.payload;
    },
    setActiveTimeframe: (state, action) => {
      state.activeTimeframe = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSelectedSector: (state, action) => {
      state.selectedSector = action.payload;
    },
    setLiveConnected: (state, action) => {
      state.liveConnected = action.payload;
    },
    setAnnouncement: (state, action) => {
      state.announcement = action.payload;
    },
    dismissAnnouncement: (state) => {
      state.announcementVisible = false;
    }
  }
});

export const {
  setScreenerData,
  setMarketXRay,
  updateLiveTick,
  setSelectedStock,
  setActiveTimeframe,
  setSearchQuery,
  setSelectedSector,
  setLiveConnected,
  setAnnouncement,
  dismissAnnouncement
} = screenerSlice.actions;

export default screenerSlice.reducer;

