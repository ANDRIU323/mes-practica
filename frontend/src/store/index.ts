import { configureStore } from '@reduxjs/toolkit';
import uiReducer, { uiListener } from './uiSlice';
import authReducer, { authListener } from './authSlice';

export const store = configureStore({
  reducer: {
    ui: uiReducer,
    auth: authReducer,
  },
  middleware: (getDefault) => getDefault().prepend(authListener.middleware, uiListener.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
