import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  plans: [],
  tierRules: {
    trial: { maxStocks: 8, allowedTimeframes: ['15m'], realTimeSpeedMs: 3000 },
    starter: { maxStocks: 30, allowedTimeframes: ['5m', '15m'], realTimeSpeedMs: 1500 },
    pro: { maxStocks: 200, allowedTimeframes: ['1m', '5m', '15m'], realTimeSpeedMs: 500 }
  },
  loading: false
};

export const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    setPlans: (state, action) => {
      state.plans = action.payload;
    },
    setTierRules: (state, action) => {
      state.tierRules = action.payload;
    }
  }
});

export const { setPlans, setTierRules } = contentSlice.actions;
export default contentSlice.reducer;
