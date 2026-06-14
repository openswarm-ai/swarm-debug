import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import Tooltip from '@mui/material/Tooltip';
import SettingsIcon from '@mui/icons-material/Settings';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import { useClaudeTokens, useThemeMode } from '@/shared/styles/ThemeContext';
import { useAppDispatch } from '@/shared/hooks';
import { setShowSettings } from '@/shared/state/debuggerSlice';

const DebuggerHeader: React.FC = () => {
  const c = useClaudeTokens();
  const { mode, toggleMode } = useThemeMode();
  const dispatch = useAppDispatch();

  return (
    <Box
      component="header"
      sx={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 56,
        px: 3,
        bgcolor: c.bg.surface,
        borderBottom: `1px solid ${c.border.subtle}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
        <Box
          component="img"
          src="/logo.png"
          alt="Open Swarm"
          sx={{ height: 26, width: 'auto' }}
        />
        <Typography
          sx={{
            fontSize: '0.95rem',
            fontWeight: 600,
            fontFamily: c.font.serif,
            color: c.text.primary,
            letterSpacing: '-0.01em',
            userSelect: 'none',
          }}
        >
          Debugger
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
          <IconButton
            onClick={toggleMode}
            size="small"
            sx={{
              color: c.text.tertiary,
              '&:hover': { color: c.accent.primary, bgcolor: `${c.accent.primary}0A` },
              transition: c.transition,
            }}
          >
            {mode === 'light' ? (
              <DarkModeIcon sx={{ fontSize: 18 }} />
            ) : (
              <LightModeIcon sx={{ fontSize: 18 }} />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            onClick={() => dispatch(setShowSettings(true))}
            size="small"
            sx={{
              color: c.text.tertiary,
              '&:hover': { color: c.accent.primary, bgcolor: `${c.accent.primary}0A` },
              transition: c.transition,
            }}
          >
            <SettingsIcon sx={{ fontSize: 18 }} />
          </IconButton>
        </Tooltip>
      </Box>
    </Box>
  );
};

export default DebuggerHeader;
