import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { FilterTab, PathFilter } from '@/types/depgraph';
import FilterTree from '@/app/pages/DependencyGraph/FilterTree';

interface Props {
  tab: FilterTab;
  pathFilter: PathFilter;
  onTabChange: (t: FilterTab) => void;
  onChange: (pf: PathFilter) => void;
}

const parse = (text: string): string[] =>
  text.split(',').map((s) => s.trim()).filter(Boolean);

const PathFilterPanel: React.FC<Props> = ({ tab, pathFilter, onTabChange, onChange }) => {
  const c = useClaudeTokens();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const includeRef = useRef<HTMLInputElement | null>(null);
  const excludeRef = useRef<HTMLInputElement | null>(null);

  const [includeText, setIncludeText] = useState(pathFilter.include.join(', '));
  const [excludeText, setExcludeText] = useState(pathFilter.exclude.join(', '));

  // Resync text from props when the change came from elsewhere (e.g. the picker
  // tab editing the include list) and the field isn't being typed into.
  useEffect(() => {
    if (document.activeElement !== includeRef.current) setIncludeText(pathFilter.include.join(', '));
  }, [pathFilter.include]);
  useEffect(() => {
    if (document.activeElement !== excludeRef.current) setExcludeText(pathFilter.exclude.join(', '));
  }, [pathFilter.exclude]);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const pushDebounced = useCallback(
    (next: PathFilter) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => onChange(next), 220);
    },
    [onChange],
  );

  const onIncludeChange = (text: string) => {
    setIncludeText(text);
    pushDebounced({ ...pathFilter, include: parse(text) });
  };
  const onExcludeChange = (text: string) => {
    setExcludeText(text);
    pushDebounced({ ...pathFilter, exclude: parse(text) });
  };

  const inputSx = {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '6px 8px',
    border: `1px solid ${c.border.strong}`,
    borderRadius: `${c.radius.md}px`,
    fontSize: '0.74rem',
    fontFamily: c.font.mono,
    background: c.bg.page,
    color: c.text.primary,
    outline: 'none',
    '&::placeholder': { color: c.text.muted },
  };

  const tabBtnSx = (active: boolean, first: boolean) => ({
    flex: 1,
    border: 0,
    borderLeft: first ? 0 : `1px solid ${c.border.strong}`,
    py: 0.6,
    fontSize: '0.72rem',
    cursor: 'pointer',
    bgcolor: active ? c.accent.primary : c.bg.surface,
    color: active ? '#fff' : c.text.primary,
    '&:hover': { bgcolor: active ? c.accent.primary : c.bg.elevated },
    transition: c.transition,
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', border: `1px solid ${c.border.strong}`, borderRadius: `${c.radius.md}px`, overflow: 'hidden' }}>
        <Box component="button" onClick={() => onTabChange('expr')} sx={tabBtnSx(tab === 'expr', true)}>
          Expressions
        </Box>
        <Box component="button" onClick={() => onTabChange('picker')} sx={tabBtnSx(tab === 'picker', false)}>
          Picker
        </Box>
      </Box>

      {tab === 'expr' ? (
        <>
          <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mt: 1.25, mb: 0.5 }}>files to include</Typography>
          <Box
            component="input"
            ref={includeRef}
            value={includeText}
            placeholder="e.g. core/**, *.py"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onIncludeChange(e.target.value)}
            sx={inputSx}
          />
          <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mt: 1, mb: 0.5 }}>files to exclude</Typography>
          <Box
            component="input"
            ref={excludeRef}
            value={excludeText}
            placeholder="e.g. tests/**, **/__init__.py"
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onExcludeChange(e.target.value)}
            sx={inputSx}
          />
        </>
      ) : (
        <Box sx={{ mt: 1 }}>
          <FilterTree
            include={pathFilter.include}
            onChange={(include) => onChange({ ...pathFilter, include })}
          />
          <Typography sx={{ fontSize: '0.66rem', color: c.text.muted, mt: 0.75 }}>
            Selected files / folders are included. Use the Expressions tab for excludes.
          </Typography>
        </Box>
      )}

      <Box
        component="label"
        sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.78rem', color: c.text.primary, cursor: 'pointer', mt: 1.25 }}
      >
        <input
          type="checkbox"
          checked={pathFilter.growHops}
          onChange={(e) => onChange({ ...pathFilter, growHops: e.target.checked })}
          style={{ accentColor: c.accent.primary }}
        />
        Grow selection by 1 hop
      </Box>
    </Box>
  );
};

export default PathFilterPanel;
