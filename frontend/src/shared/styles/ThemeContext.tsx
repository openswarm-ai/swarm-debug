import React, { createContext, useContext, useMemo, useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

const FONT_SERIF = '"Anthropic Sans", ui-serif, Georgia, Cambria, "Times New Roman", Times, serif';
const FONT_MONO = 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace';

const darkTokens = {
  bg: {
    page: '#1a1918',
    surface: '#262624',
    elevated: '#30302E',
    secondary: '#1f1e1b',
    inverse: '#FAF9F5',
  },
  text: {
    primary: '#FAF9F5',
    secondary: '#C2C0B6',
    tertiary: '#9C9A92',
    muted: '#85837C',
    ghost: 'rgba(156,154,146,0.5)',
  },
  accent: {
    primary: '#c4633a',
    hover: '#d47548',
    pressed: '#ae5630',
  },
  user: { bubble: '#393937' },
  border: {
    subtle: 'rgba(255,255,255,0.07)',
    medium: 'rgba(255,255,255,0.10)',
    strong: 'rgba(255,255,255,0.18)',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.12)',
    md: '0 0.25rem 1.25rem rgba(0,0,0,0.15)',
    lg: '0 0.5rem 2rem rgba(0,0,0,0.25)',
  },
  status: {
    success: '#66bb6a',
    successBg: 'rgba(102,187,106,0.12)',
    error: '#ef5350',
    errorBg: 'rgba(239,83,80,0.12)',
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    full: 9999,
  },
  font: {
    serif: FONT_SERIF,
    mono: FONT_MONO,
  },
  transition: 'all 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
};

type ClaudeTokens = typeof darkTokens;

const lightTokens: ClaudeTokens = {
  bg: {
    page: '#FAF9F5',
    surface: '#ffffff',
    elevated: '#f3f1ec',
    secondary: '#f0eee8',
    inverse: '#1a1918',
  },
  text: {
    primary: '#1a1918',
    secondary: '#44423d',
    tertiary: '#6b6962',
    muted: '#8a887f',
    ghost: 'rgba(107,105,98,0.5)',
  },
  accent: {
    primary: '#c4633a',
    hover: '#d47548',
    pressed: '#ae5630',
  },
  user: { bubble: '#ece9e2' },
  border: {
    subtle: 'rgba(0,0,0,0.08)',
    medium: 'rgba(0,0,0,0.12)',
    strong: 'rgba(0,0,0,0.18)',
  },
  shadow: {
    sm: '0 1px 3px rgba(0,0,0,0.08)',
    md: '0 0.25rem 1.25rem rgba(0,0,0,0.10)',
    lg: '0 0.5rem 2rem rgba(0,0,0,0.15)',
  },
  status: {
    success: '#2e7d32',
    successBg: 'rgba(46,125,50,0.10)',
    error: '#c62828',
    errorBg: 'rgba(198,40,40,0.10)',
  },
  radius: {
    xs: 4,
    sm: 6,
    md: 8,
    lg: 10,
    xl: 12,
    full: 9999,
  },
  font: {
    serif: FONT_SERIF,
    mono: FONT_MONO,
  },
  transition: 'all 300ms cubic-bezier(0.165, 0.85, 0.45, 1)',
};

const TokensContext = createContext<ClaudeTokens>(lightTokens);

export function useClaudeTokens(): ClaudeTokens {
  return useContext(TokensContext);
}

type ThemeMode = 'light' | 'dark';

interface ThemeModeContextValue {
  mode: ThemeMode;
  toggleMode: () => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue>({
  mode: 'light',
  toggleMode: () => {},
});

export function useThemeMode(): ThemeModeContextValue {
  return useContext(ThemeModeContext);
}

const THEME_STORAGE_KEY = 'debugger-theme';

const loadMode = (): ThemeMode => {
  try {
    const saved = localStorage.getItem(THEME_STORAGE_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
};

const createMuiTheme = (mode: ThemeMode, tokens: ClaudeTokens) =>
  createTheme({
    palette: { mode },
    typography: {
      fontFamily: FONT_SERIF,
      button: { textTransform: 'none' as const },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: tokens.bg.page,
            color: tokens.text.primary,
          },
        },
      },
    },
  });

interface ClaudeThemeProviderProps {
  children: React.ReactNode;
}

const ClaudeThemeProvider: React.FC<ClaudeThemeProviderProps> = ({ children }) => {
  const [mode, setMode] = useState<ThemeMode>(loadMode);

  const toggleMode = () => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      try {
        localStorage.setItem(THEME_STORAGE_KEY, next);
      } catch {
        /* ignore persistence errors */
      }
      return next;
    });
  };

  const tokens = mode === 'light' ? lightTokens : darkTokens;
  const muiTheme = useMemo(() => createMuiTheme(mode, tokens), [mode, tokens]);

  return (
    <ThemeModeContext.Provider value={{ mode, toggleMode }}>
      <TokensContext.Provider value={tokens}>
        <ThemeProvider theme={muiTheme}>
          <CssBaseline />
          {children}
        </ThemeProvider>
      </TokensContext.Provider>
    </ThemeModeContext.Provider>
  );
};

export default ClaudeThemeProvider;
