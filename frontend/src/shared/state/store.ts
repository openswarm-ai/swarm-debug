import { configureStore } from '@reduxjs/toolkit';
import debuggerReducer from './debuggerSlice';
import depgraphReducer from './depgraphSlice';

export const store = configureStore({
  reducer: {
    debugger: debuggerReducer,
    depgraph: depgraphReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
