import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
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
import SettingsModal from '@/app/components/SettingsModal/SettingsModal';
import { useAppSelector } from '@/shared/hooks';

const NAV = [
  { to: '/', label: 'Debugger', end: true },
  { to: '/graph', label: 'Dependency Graph', end: false },
];

const Layout: React.FC = () => {
  const c = useClaudeTokens();
  const { mode, toggleMode } = useThemeMode();
  const dispatch = useAppDispatch();
  const showSettings = useAppSelector((s) => s.debugger.showSettings);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100vh', bgcolor: c.bg.page, color: c.text.primary }}>
      <Box
        component="header"
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 56,
          px: 3,
          bgcolor: c.bg.surface,
          borderBottom: `1px solid ${c.border.subtle}`,
          zIndex: 100,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
            <Box component="img" src="/logo.png" alt="Open Swarm" sx={{ height: 26, width: 'auto' }} />
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
              Open Swarm
            </Typography>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {NAV.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} style={{ textDecoration: 'none' }}>
                {({ isActive }) => (
                  <Box
                    sx={{
                      px: 1.5,
                      py: 0.6,
                      borderRadius: `${c.radius.md}px`,
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 600 : 500,
                      color: isActive ? c.text.primary : c.text.tertiary,
                      bgcolor: isActive ? c.bg.elevated : 'transparent',
                      cursor: 'pointer',
                      '&:hover': { color: c.text.primary, bgcolor: c.bg.elevated },
                      transition: c.transition,
                    }}
                  >
                    {item.label}
                  </Box>
                )}
              </NavLink>
            ))}
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={mode === 'light' ? 'Dark mode' : 'Light mode'}>
            <IconButton
              onClick={toggleMode}
              size="small"
              sx={{ color: c.text.tertiary, '&:hover': { color: c.accent.primary, bgcolor: `${c.accent.primary}0A` }, transition: c.transition }}
            >
              {mode === 'light' ? <DarkModeIcon sx={{ fontSize: 18 }} /> : <LightModeIcon sx={{ fontSize: 18 }} />}
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton
              onClick={() => dispatch(setShowSettings(true))}
              size="small"
              sx={{ color: c.text.tertiary, '&:hover': { color: c.accent.primary, bgcolor: `${c.accent.primary}0A` }, transition: c.transition }}
            >
              <SettingsIcon sx={{ fontSize: 18 }} />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flex: '1 1 auto', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Outlet />
      </Box>

      {showSettings && <SettingsModal />}
    </Box>
  );
};

export default Layout;
