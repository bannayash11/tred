import { configureStore } from '@reduxjs/toolkit';
import authReducer from './slices/authSlice.js';
import screenerReducer from './slices/screenerSlice.js';
import contentReducer from './slices/contentSlice.js';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    screener: screenerReducer,
    content: contentReducer
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    })
});

export default store;

