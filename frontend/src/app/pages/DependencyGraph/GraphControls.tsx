import React, { useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import GraphStats from '@/app/pages/DependencyGraph/GraphStats';
import {
  ColorMode,
  EdgeDir,
  FilterMode,
  FilterTab,
  GraphStats as Stats,
  GraphView,
  HighlightMode,
  LayoutName,
  OverlayMode,
  PathFilter,
} from '@/types/depgraph';
import PathFilterPanel from '@/app/pages/DependencyGraph/PathFilterPanel';

export interface ControlsState {
  view: GraphView;
  colorMode: ColorMode;
  extOn: boolean;
  crossOnly: boolean;
  filter: FilterMode;
  overlay: OverlayMode;
  hlMode: HighlightMode;
  hlDir: EdgeDir;
  layoutName: LayoutName;
  filterTab: FilterTab;
  pathFilter: PathFilter;
  // folder view: ids (root-relative POSIX dir paths) of currently-collapsed folders.
  folderCollapsed: string[];
}

export interface FolderActions {
  onExpandAll: () => void;
  onCollapseAll: () => void;
  onCollapseDepth: (depth: number) => void;
  count: number;
}

interface Props {
  controls: ControlsState;
  update: (partial: Partial<ControlsState>) => void;
  stats: Stats | null;
  layoutDisabled: (l: LayoutName) => boolean;
  folderActions?: FolderActions;
}

const MIN_WIDTH = 200;
const MAX_WIDTH = 460;
const DEFAULT_WIDTH = 232;
const WIDTH_STORAGE_KEY = 'depgraph-sidebar-width';

const GraphControls: React.FC<Props> = ({ controls, update, stats, layoutDisabled, folderActions }) => {
  const c = useClaudeTokens();

  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(WIDTH_STORAGE_KEY));
      if (saved >= MIN_WIDTH && saved <= MAX_WIDTH) return saved;
    } catch {
      /* ignore */
    }
    return DEFAULT_WIDTH;
  });
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef(false);
  const sidebarRef = useRef<HTMLDivElement | null>(null);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragRef.current = true;
    setDragging(true);
  }, []);

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      const left = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const next = Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, e.clientX - left));
      setWidth(next);
    };
    const onUp = () => {
      dragRef.current = false;
      setDragging(false);
    };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [dragging]);

  useEffect(() => {
    try {
      localStorage.setItem(WIDTH_STORAGE_KEY, String(width));
    } catch {
      /* ignore */
    }
  }, [width]);

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

  const folderBtnSx = {
    flex: 1,
    border: `1px solid ${c.border.strong}`,
    borderRadius: `${c.radius.md}px`,
    py: 0.6,
    bgcolor: c.bg.surface,
    color: c.text.primary,
    fontSize: '0.72rem',
    textTransform: 'none' as const,
    cursor: 'pointer',
    '&:hover': { bgcolor: c.bg.elevated },
    transition: c.transition,
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
      ref={sidebarRef}
      sx={{
        flex: `0 0 ${width}px`,
        width: `${width}px`,
        position: 'relative',
        borderRight: `1px solid ${c.border.subtle}`,
        bgcolor: c.bg.surface,
        minHeight: 0,
        height: '100%',
      }}
    >
      <Box
        sx={{
          height: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollbarWidth: 'thin',
          scrollbarColor: `${c.border.strong} transparent`,
          '&::-webkit-scrollbar': { width: 10 },
          '&::-webkit-scrollbar-track': { background: 'transparent' },
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: c.border.strong,
            borderRadius: `${c.radius.full}px`,
            border: '2px solid transparent',
            backgroundClip: 'padding-box',
            transition: c.transition,
          },
          '&::-webkit-scrollbar-thumb:hover': {
            backgroundColor: c.accent.primary,
            backgroundClip: 'padding-box',
          },
        }}
      >
      {renderSection(
        'View',
        renderSegmented(
          controls.view,
          [
            { val: 'file' as GraphView, label: 'File' },
            { val: 'folder' as GraphView, label: 'Folder' },
            { val: 'pkg' as GraphView, label: 'Package' },
          ],
          (v) => update({ view: v }),
        ),
      )}

      {controls.view === 'folder' &&
        folderActions &&
        renderSection(
          'Folders',
          <>
            <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mb: 0.75 }}>
              Double-click a folder to expand / collapse it.
            </Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              <Box component="button" onClick={folderActions.onExpandAll} sx={folderBtnSx}>
                Expand all
              </Box>
              <Box component="button" onClick={folderActions.onCollapseAll} sx={folderBtnSx}>
                Collapse all
              </Box>
            </Box>
            <Typography sx={{ fontSize: '0.7rem', color: c.text.secondary, mt: 1.25, mb: 0.5 }}>Collapse below depth</Typography>
            <Box sx={{ display: 'flex', gap: 0.75 }}>
              {[1, 2, 3].map((d) => (
                <Box key={d} component="button" onClick={() => folderActions.onCollapseDepth(d)} sx={{ ...folderBtnSx, flex: 1 }}>
                  {d}
                </Box>
              ))}
            </Box>
            <Typography sx={{ fontSize: '0.65rem', color: c.text.muted, mt: 1 }}>
              {folderActions.count} folder{folderActions.count === 1 ? '' : 's'} collapsed
            </Typography>
          </>,
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
        'Filter paths',
        <PathFilterPanel
          tab={controls.filterTab}
          pathFilter={controls.pathFilter}
          onTabChange={(t) => update({ filterTab: t })}
          onChange={(pf) => update({ pathFilter: pf })}
        />,
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
              { val: 'coverage' as OverlayMode, label: 'Debug' },
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
          <Box sx={{ mt: 1 }}>
            {renderSegmented(
              controls.hlDir,
              [
                { val: 'both' as EdgeDir, label: 'All' },
                { val: 'imports' as EdgeDir, label: 'Imports' },
                { val: 'importedBy' as EdgeDir, label: 'Imported by' },
              ],
              (v) => update({ hlDir: v }),
            )}
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

      <Box
        onMouseDown={startResize}
        onDoubleClick={() => setWidth(DEFAULT_WIDTH)}
        title="Drag to resize · double-click to reset"
        sx={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: 6,
          height: '100%',
          cursor: 'col-resize',
          zIndex: 5,
          '&::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            right: 0,
            width: 2,
            height: '100%',
            backgroundColor: dragging ? c.accent.primary : 'transparent',
            transition: c.transition,
          },
          '&:hover::after': { backgroundColor: c.accent.primary },
        }}
      />
    </Box>
  );
};

export default GraphControls;
