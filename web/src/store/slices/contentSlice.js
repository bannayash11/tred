import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  news: [],
  blogs: [],
  selectedBlog: null,
  plans: [],
  tierRules: {
    trial: { maxStocks: 8, allowedTimeframes: ['15m'], maxJournal: 5, realTimeSpeedMs: 3000 },
    starter: { maxStocks: 30, allowedTimeframes: ['5m', '15m'], maxJournal: 30, realTimeSpeedMs: 1500 },
    pro: { maxStocks: 200, allowedTimeframes: ['1m', '5m', '15m'], maxJournal: 9999, realTimeSpeedMs: 500 }
  },
  loading: false
};

export const contentSlice = createSlice({
  name: 'content',
  initialState,
  reducers: {
    setNews: (state, action) => {
      state.news = action.payload;
    },
    setBlogs: (state, action) => {
      state.blogs = action.payload;
    },
    setSelectedBlog: (state, action) => {
      state.selectedBlog = action.payload;
    },
    setPlans: (state, action) => {
      state.plans = action.payload;
    },
    setTierRules: (state, action) => {
      state.tierRules = action.payload;
    }
  }
});

export const { setNews, setBlogs, setSelectedBlog, setPlans, setTierRules } = contentSlice.actions;
export default contentSlice.reducer;

