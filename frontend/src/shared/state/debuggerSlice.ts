import { createSlice, PayloadAction, current } from '@reduxjs/toolkit';
import { TreeNodeData, DebuggerSettings, SaveStatus, ExpandedState } from '@/types';
import { pullWithRetry, pushStructure, resetColors, resetEmojis } from './debuggerThunks';
import {
  buildExpandedState,
  recomputeParentToggles,
  treeFingerprint,
  toggleTargetNode,
  updateNodeColor,
  updateNodeEmoji,
} from './treeUtils';

const DEFAULT_SETTINGS: DebuggerSettings = {
  pullRetryCount: 3,
  pullRetryDelay: 2,
  autoSave: false,
  defaultExpanded: true,
};

const loadSettings = (): DebuggerSettings => {
  try {
    const saved = localStorage.getItem('debugger-settings');
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

interface DebuggerState {
  projectStructure: TreeNodeData[] | null;
  lastSavedSnapshot: string;
  expanded: ExpandedState;
  error: string | null;
  loading: boolean;
  fetching: boolean;
  dirty: boolean;
  saveStatus: SaveStatus;
  settings: DebuggerSettings;
  showSettings: boolean;
}

const initialState: DebuggerState = {
  projectStructure: null,
  lastSavedSnapshot: '',
  expanded: {},
  error: null,
  loading: true,
  fetching: false,
  dirty: false,
  saveStatus: 'idle',
  settings: loadSettings(),
  showSettings: false,
};

const debuggerSlice = createSlice({
  name: 'debugger',
  initialState,
  reducers: {
    toggleExpanded(state, action: PayloadAction<string>) {
      const id = action.payload;
      state.expanded[id] = !state.expanded[id];
    },

    checkboxChange(state, action: PayloadAction<{ nodeId: string; checked: boolean }>) {
      const { nodeId, checked } = action.payload;
      if (!state.projectStructure) return;
      state.projectStructure = recomputeParentToggles(
        toggleTargetNode(state.projectStructure, nodeId.split('/'), checked),
      );
      state.dirty = treeFingerprint(current(state).projectStructure) !== state.lastSavedSnapshot;
      state.saveStatus = 'idle';
    },

    colorChange(state, action: PayloadAction<{ nodeId: string; color: string }>) {
      const { nodeId, color } = action.payload;
      if (!state.projectStructure) return;
      state.projectStructure = updateNodeColor(state.projectStructure, nodeId.split('/'), color, true);
      state.dirty = treeFingerprint(current(state).projectStructure) !== state.lastSavedSnapshot;
      state.saveStatus = 'idle';
    },

    emojiChange(state, action: PayloadAction<{ nodeId: string; emoji: string }>) {
      const { nodeId, emoji } = action.payload;
      if (!state.projectStructure) return;
      state.projectStructure = updateNodeEmoji(state.projectStructure, nodeId.split('/'), emoji);
      state.dirty = treeFingerprint(current(state).projectStructure) !== state.lastSavedSnapshot;
      state.saveStatus = 'idle';
    },

    updateSettings(state, action: PayloadAction<Partial<DebuggerSettings>>) {
      state.settings = { ...state.settings, ...action.payload };
      localStorage.setItem('debugger-settings', JSON.stringify(state.settings));
    },

    markDirty(state) {
      state.dirty = true;
      state.saveStatus = 'idle';
    },

    setSaveStatus(state, action: PayloadAction<SaveStatus>) {
      state.saveStatus = action.payload;
    },

    setShowSettings(state, action: PayloadAction<boolean>) {
      state.showSettings = action.payload;
    },

    expandAll(state) {
      if (state.projectStructure) {
        state.expanded = buildExpandedState(state.projectStructure);
      }
    },

    collapseAll(state) {
      state.expanded = {};
    },
  },

  extraReducers: (builder) => {
    builder
      .addCase(pullWithRetry.pending, (state) => {
        state.loading = true;
        state.fetching = true;
        state.error = null;
      })
      .addCase(pullWithRetry.fulfilled, (state, action) => {
        state.projectStructure = action.payload;
        state.lastSavedSnapshot = treeFingerprint(action.payload);
        state.loading = false;
        state.fetching = false;
        state.error = null;
        state.dirty = false;
        if (state.settings.defaultExpanded) {
          state.expanded = buildExpandedState(action.payload);
        } else {
          state.expanded = {};
        }
      })
      .addCase(pullWithRetry.rejected, (state, action) => {
        state.loading = false;
        state.fetching = false;
        state.error = action.error.message || 'Unknown error';
      })

      .addCase(pushStructure.pending, (state) => {
        state.saveStatus = 'saving';
      })
      .addCase(pushStructure.fulfilled, (state, action) => {
        state.projectStructure = action.payload;
        state.lastSavedSnapshot = treeFingerprint(action.payload);
        state.dirty = false;
        state.saveStatus = 'saved';
      })
      .addCase(pushStructure.rejected, (state) => {
        state.saveStatus = 'idle';
      })

      .addCase(resetColors.pending, (state) => {
        state.saveStatus = 'saving';
      })
      .addCase(resetColors.fulfilled, (state, action) => {
        state.projectStructure = action.payload;
        state.lastSavedSnapshot = treeFingerprint(action.payload);
        state.dirty = false;
        state.saveStatus = 'saved';
      })
      .addCase(resetColors.rejected, (state) => {
        state.saveStatus = 'idle';
      })

      .addCase(resetEmojis.pending, (state) => {
        state.saveStatus = 'saving';
      })
      .addCase(resetEmojis.fulfilled, (state, action) => {
        state.projectStructure = action.payload;
        state.lastSavedSnapshot = treeFingerprint(action.payload);
        state.dirty = false;
        state.saveStatus = 'saved';
      })
      .addCase(resetEmojis.rejected, (state) => {
        state.saveStatus = 'idle';
      });
  },
});

export const {
  toggleExpanded,
  checkboxChange,
  colorChange,
  updateSettings,
  setSaveStatus,
  setShowSettings,
  expandAll,
  collapseAll,
} = debuggerSlice.actions;

export { pullWithRetry, pushStructure, resetColors, resetEmojis } from './debuggerThunks';

export default debuggerSlice.reducer;
