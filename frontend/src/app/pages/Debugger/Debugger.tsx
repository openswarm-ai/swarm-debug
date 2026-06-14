import React, { useEffect, useRef } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import { motion } from 'framer-motion';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import { pullWithRetry, pushStructure, setSaveStatus, expandAll, collapseAll } from '@/shared/state/debuggerSlice';
import { EVENTS_URL } from '@/shared/state/API_ENDPOINTS';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import CloseFullscreenIcon from '@mui/icons-material/CloseFullscreen';
import Tree from '@/app/components/Tree/Tree';
import SyncSection from '@/app/components/SyncSection/SyncSection';

const expandCollapseAllIconSize = 11;

const Debugger: React.FC = () => {
  const c = useClaudeTokens();
  const dispatch = useAppDispatch();
  const projectStructure = useAppSelector((s) => s.debugger.projectStructure);
  const loading = useAppSelector((s) => s.debugger.loading);
  const error = useAppSelector((s) => s.debugger.error);
  const dirty = useAppSelector((s) => s.debugger.dirty);
  const saveStatus = useAppSelector((s) => s.debugger.saveStatus);
  const settings = useAppSelector((s) => s.debugger.settings);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;

  useEffect(() => {
    dispatch(pullWithRetry());
  }, [dispatch]);

  useEffect(() => {
    const es = new EventSource(EVENTS_URL);
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    es.onmessage = () => {
      if (!dirtyRef.current) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => dispatch(pullWithRetry()), 500);
      }
    };
    return () => {
      es.close();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [dispatch]);

  useEffect(() => {
    if (saveStatus === 'saved') {
      savedTimerRef.current = setTimeout(() => dispatch(setSaveStatus('idle')), 1500);
    }
    return () => {
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
    };
  }, [saveStatus, dispatch]);

  useEffect(() => {
    if (!settings.autoSave || !dirty) return;
    autoSaveTimerRef.current = setTimeout(() => {
      dispatch(pushStructure());
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [dirty, settings.autoSave, dispatch]);

  return (
    <Box sx={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', bgcolor: c.bg.page, color: c.text.primary }}>
      <Box
        component="main"
        sx={{ maxWidth: 960, mx: 'auto', px: 3, pt: 3, pb: 6 }}
      >
        {projectStructure ? (
          <>
            <Box
              sx={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                mb: 0.5,
              }}
            >
              <Box sx={{ opacity: 0.45 }}>
                <SyncSection />
              </Box>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.75,
                  opacity: 0.45,
                }}
              >
              <Button
                size="small"
                startIcon={<OpenInFullIcon sx={{ width: expandCollapseAllIconSize, height: expandCollapseAllIconSize }} />}
                onClick={() => dispatch(expandAll())}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  color: c.text.tertiary,
                  px: 0.75,
                  py: 0,
                  minWidth: 0,
                  minHeight: 0,
                  lineHeight: 1.4,
                  '&:hover': { bgcolor: 'transparent', color: c.text.primary, opacity: 1 },
                  transition: c.transition,
                }}
              >
                Expand all
              </Button>
              <Button
                size="small"
                startIcon={<CloseFullscreenIcon sx={{ width: expandCollapseAllIconSize, height: expandCollapseAllIconSize }} />}
                onClick={() => dispatch(collapseAll())}
                sx={{
                  textTransform: 'none',
                  fontSize: '0.7rem',
                  fontWeight: 400,
                  color: c.text.tertiary,
                  px: 0.75,
                  py: 0,
                  minWidth: 0,
                  minHeight: 0,
                  lineHeight: 1.4,
                  '&:hover': { bgcolor: 'transparent', color: c.text.primary, opacity: 1 },
                  transition: c.transition,
                }}
              >
                Collapse all
              </Button>
              </Box>
            </Box>
            <Box
              sx={{
                bgcolor: c.bg.surface,
                border: `1px solid ${c.border.subtle}`,
                borderRadius: `${c.radius.xl}px`,
                boxShadow: c.shadow.sm,
                p: 1,
              }}
            >
              <Tree />
            </Box>
          </>
        ) : loading ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: `${c.radius.xl}px`,
                  bgcolor: c.bg.elevated,
                  mb: 2.5,
                }}
              >
                <CircularProgress size={24} sx={{ color: c.text.tertiary }} />
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>Connecting...</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: c.text.tertiary, maxWidth: 320 }}>
                Loading your project's debug configuration.
              </Typography>
            </Box>
          </motion.div>
        ) : error ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: `${c.radius.xl}px`,
                  bgcolor: c.status.errorBg,
                  color: c.status.error,
                  mb: 2.5,
                }}
              >
                <Typography sx={{ fontSize: 24 }}>!</Typography>
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>Connection failed</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: c.text.tertiary, maxWidth: 320, lineHeight: 1.5 }}>
                {error}
              </Typography>
              <Button
                onClick={() => dispatch(pullWithRetry())}
                sx={{
                  mt: 2.5,
                  height: 36,
                  px: 2.5,
                  bgcolor: c.accent.primary,
                  color: '#fff',
                  textTransform: 'none',
                  fontWeight: 500,
                  fontSize: '0.85rem',
                  borderRadius: `${c.radius.md}px`,
                  '&:hover': { bgcolor: c.accent.hover },
                  '&:active': { transform: 'scale(0.97)', bgcolor: c.accent.pressed },
                  transition: c.transition,
                }}
              >
                Retry
              </Button>
            </Box>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 10, textAlign: 'center' }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 56,
                  height: 56,
                  borderRadius: `${c.radius.xl}px`,
                  bgcolor: c.bg.elevated,
                  color: c.text.tertiary,
                  mb: 2.5,
                }}
              >
                <Typography sx={{ fontSize: 24, opacity: 0.6 }}>?</Typography>
              </Box>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 1 }}>No configuration loaded</Typography>
              <Typography sx={{ fontSize: '0.85rem', color: c.text.tertiary, maxWidth: 320 }}>
                Could not load your project's debug configuration.
              </Typography>
            </Box>
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

export default Debugger;
