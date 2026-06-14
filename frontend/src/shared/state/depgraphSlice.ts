import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { DEPGRAPH_SCAN_URL } from './API_ENDPOINTS';
import { GraphPayload } from '@/types/depgraph';

const SCAN_TIMEOUT_MS = 30000;

export const scanGraph = createAsyncThunk('depgraph/scan', async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SCAN_TIMEOUT_MS);
  try {
    const res = await fetch(DEPGRAPH_SCAN_URL, { signal: controller.signal });
    if (!res.ok) throw new Error(`Server responded with ${res.status}`);
    return (await res.json()) as GraphPayload;
  } finally {
    clearTimeout(timer);
  }
});

interface DepgraphState {
  data: GraphPayload | null;
  loading: boolean;
  error: string | null;
}

const initialState: DepgraphState = {
  data: null,
  loading: false,
  error: null,
};

const depgraphSlice = createSlice({
  name: 'depgraph',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(scanGraph.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(scanGraph.fulfilled, (state, action) => {
        state.data = action.payload;
        state.loading = false;
        state.error = null;
      })
      .addCase(scanGraph.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to scan project';
      });
  },
});

export default depgraphSlice.reducer;
