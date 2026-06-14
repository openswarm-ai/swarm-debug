import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import GraphStats from '@/app/pages/DependencyGraph/GraphStats';
import {
  ColorMode,
  FilterMode,
  GraphStats as Stats,
  GraphView,
  HighlightMode,
  LayoutName,
  OverlayMode,
} from '@/types/depgraph';

export interface ControlsState {
  view: GraphView;
  colorMode: ColorMode;
  extOn: boolean;
  crossOnly: boolean;
  filter: FilterMode;
  overlay: OverlayMode;
  hlMode: HighlightMode;
  layoutName: LayoutName;
}

interface Props {
  controls: ControlsState;
  update: (partial: Partial<ControlsState>) => void;
  stats: Stats | null;
  layoutDisabled: (l: LayoutName) => boolean;
}

const GraphControls: React.FC<Props> = ({ controls, update, stats, layoutDisabled }) => {
  const c = useClaudeTokens();

  const labelSx = {
    fontSize: '0.6rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    color: c.text.muted,
    fontWeight: 600,
    mb: 0.5,
    display: 'block',
  };

  const selectSx = {
    width: '100%',
    padding: '6px 8px',
    border: `1px solid ${c.border.strong}`,
    borderRadius: `${c.radius.md}px`,
    fontSize: '0.78rem',
    background: c.bg.surface,
    color: c.text.primary,
    outline: 'none',
    cursor: 'pointer',
  };

  const renderSection = (title: string, children: React.ReactNode) => (
    <Box sx={{ px: 1.75, py: 1.5, borderBottom: `1px solid ${c.border.subtle}` }}>
      <Typography sx={labelSx}>{title}</Typography>
      {children}
    </Box>
  );

  function renderSegmented<T extends string>(
    value: T,
    options: { val: T; label: string }[],
    onChange: (v: T) => void,
  ) {
    return (
      <Box sx={{ display: 'flex', border: `1px solid ${c.border.strong}`, borderRadius: `${c.radius.md}px`, overflow: 'hidden' }}>
        {options.map((o, i) => {
          const active = o.val === value;
          return (
            <Box
              key={o.val}
              component="button"
              onClick={() => onChange(o.val)}
              sx={{
                flex: 1,
                border: 0,
                borderLeft: i === 0 ? 0 : `1px solid ${c.border.strong}`,
                py: 0.7,
                fontSize: '0.72rem',
                cursor: 'pointer',
                bgcolor: active ? c.accent.primary : c.bg.surface,
                color: active ? '#fff' : c.text.primary,
                '&:hover': { bgcolor: active ? c.accent.primary : c.bg.elevated },
                transition: c.transition,
              }}
            >
              {o.label}
            </Box>
          );
        })}
      </Box>
    );
  }

  const renderCheckbox = (checked: boolean, onChange: (b: boolean) => void, label: string) => (
    <Box
      component="label"
      sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: '0.78rem', color: c.text.primary, cursor: 'pointer', mt: 1 }}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} style={{ accentColor: c.accent.primary }} />
      {label}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: '0 0 232px',
        borderRight: `1px solid ${c.border.subtle}`,
        bgcolor: c.bg.surface,
        overflowY: 'auto',
        minHeight: 0,
        height: '100%',
      }}
    >
      {renderSection(
        'View',
        renderSegmented(
          controls.view,
          [
            { val: 'file' as GraphView, label: 'File' },
            { val: 'pkg' as GraphView, label: 'Package' },
          ],
          (v) => update({ view: v }),
        ),
      )}

      {renderSection(
        'Display',
        <>
          <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mb: 0.5 }}>Color by</Typography>
          <Box
            component="select"
            value={controls.colorMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ colorMode: e.target.value as ColorMode })}
            sx={selectSx}
          >
            <option value="pkg">Package</option>
            <option value="inst">Instability</option>
          </Box>
          {renderCheckbox(controls.extOn, (b) => update({ extOn: b }), 'External (third-party) deps')}
        </>,
      )}

      {renderSection(
        'Filter',
        <>
          <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mb: 0.5 }}>Show nodes</Typography>
          <Box
            component="select"
            value={controls.filter}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ filter: e.target.value as FilterMode })}
            sx={selectSx}
          >
            <option value="all">All nodes</option>
            <option value="single">Single-importer (in = 1)</option>
            <option value="orphan">Unimported (in = 0)</option>
            <option value="leaf">Leaf / no internal deps (out = 0)</option>
            <option value="hub">Hubs (top fan-in)</option>
          </Box>
          {renderCheckbox(controls.crossOnly, (b) => update({ crossOnly: b }), 'Cross-package edges only')}
        </>,
      )}

      {renderSection(
        'Highlight',
        <>
          {renderSegmented(
            controls.overlay,
            [
              { val: 'none' as OverlayMode, label: 'None' },
              { val: 'violations' as OverlayMode, label: 'Violations' },
              { val: 'cycles' as OverlayMode, label: 'Cycles' },
            ],
            (v) => update({ overlay: v }),
          )}
          <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mt: 1.25, mb: 0.5 }}>On node click</Typography>
          <Box
            component="select"
            value={controls.hlMode}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ hlMode: e.target.value as HighlightMode })}
            sx={selectSx}
          >
            <option value="direct">Direct deps</option>
            <option value="transitive">Transitive (blast radius)</option>
          </Box>
        </>,
      )}

      {renderSection(
        'Layout',
        <Box
          component="select"
          value={controls.layoutName}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => update({ layoutName: e.target.value as LayoutName })}
          sx={selectSx}
        >
          <option value="dagre" disabled={layoutDisabled('dagre')}>Layered (flow)</option>
          <option value="fcose" disabled={layoutDisabled('fcose')}>Clustered (force)</option>
          <option value="concentric" disabled={layoutDisabled('concentric')}>Hubs (concentric)</option>
        </Box>,
      )}

      {stats && renderSection('Project stats', <GraphStats stats={stats} />)}
    </Box>
  );
};

export default GraphControls;
