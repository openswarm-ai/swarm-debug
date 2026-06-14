import { createAsyncThunk } from '@reduxjs/toolkit';
import {
  PULL_STRUCTURE_URL,
  PUSH_STRUCTURE_URL,
  RESET_COLOR_URL,
  RESET_EMOJI_URL,
} from './API_ENDPOINTS';
import { TreeNodeData } from '@/types';
import type { RootState } from './store';

const PULL_TIMEOUT_MS = 15000;

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const pullWithRetry = createAsyncThunk(
  'debugger/pullWithRetry',
  async (_, { getState }) => {
    const { debugger: state } = getState() as RootState;
    const { pullRetryCount, pullRetryDelay } = state.settings;

    for (let attempt = 1; attempt <= pullRetryCount; attempt++) {
      try {
        const response = await fetchWithTimeout(PULL_STRUCTURE_URL, PULL_TIMEOUT_MS);
        if (!response.ok) {
          throw new Error(`Server responded with ${response.status}`);
        }
        const data: TreeNodeData[] = await response.json();
        return data;
      } catch {
        if (attempt < pullRetryCount) {
          await new Promise((resolve) => setTimeout(resolve, pullRetryDelay * 1000));
        }
      }
    }

    throw new Error(
      `Failed to connect to the backend after ${pullRetryCount} attempt${pullRetryCount !== 1 ? 's' : ''}. Make sure the server is running.`,
    );
  },
  {
    condition: (_, { getState }) => {
      const { debugger: state } = (getState() as RootState);
      // Guard against overlapping in-flight pulls only. Must NOT key off
      // `loading`, which starts true for the initial UI state and would
      // otherwise cancel the very first (legitimate) load.
      return !state.fetching;
    },
  },
);

export const pushStructure = createAsyncThunk(
  'debugger/pushStructure',
  async (_, { getState }) => {
    const { debugger: state } = getState() as RootState;
    if (!state.projectStructure) throw new Error('No data to save');

    await fetch(PUSH_STRUCTURE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectStructure: state.projectStructure }),
    });

    const response = await fetch(PULL_STRUCTURE_URL);
    const data: TreeNodeData[] = await response.json();
    return data;
  },
);

export const resetColors = createAsyncThunk('debugger/resetColors', async () => {
  const resetResponse = await fetch(RESET_COLOR_URL, { method: 'POST' });
  const resetData: TreeNodeData[] = await resetResponse.json();

  await fetch(PUSH_STRUCTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectStructure: resetData }),
  });

  const freshResponse = await fetch(PULL_STRUCTURE_URL);
  const fresh: TreeNodeData[] = await freshResponse.json();
  return fresh;
});

export const resetEmojis = createAsyncThunk('debugger/resetEmojis', async () => {
  const resetResponse = await fetch(RESET_EMOJI_URL, { method: 'POST' });
  const resetData: TreeNodeData[] = await resetResponse.json();

  await fetch(PUSH_STRUCTURE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectStructure: resetData }),
  });

  const freshResponse = await fetch(PULL_STRUCTURE_URL);
  const fresh: TreeNodeData[] = await freshResponse.json();
  return fresh;
});
