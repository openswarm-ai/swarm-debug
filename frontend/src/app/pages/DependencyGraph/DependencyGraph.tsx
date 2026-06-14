import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import CircularProgress from '@mui/material/CircularProgress';
import RefreshIcon from '@mui/icons-material/Refresh';
import { motion } from 'framer-motion';
import { useClaudeTokens, useThemeMode } from '@/shared/styles/ThemeContext';
import { useAppDispatch, useAppSelector } from '@/shared/hooks';
import { scanGraph } from '@/shared/state/depgraphSlice';
import { InspectorData, LayoutName } from '@/types/depgraph';
import GraphControls, { ControlsState } from '@/app/pages/DependencyGraph/GraphControls';
import GraphInspector from '@/app/pages/DependencyGraph/GraphInspector';
import {
  buildGraphStyle,
  buildPkgColorMap,
  GRAPH_THEME,
  LAYOUTS,
  registerCytoscapePlugins,
} from '@/app/pages/DependencyGraph/graph/cyConfig';
import * as ops from '@/app/pages/DependencyGraph/graph/graphOps';

registerCytoscapePlugins();

const DEFAULT_CONTROLS: ControlsState = {
  view: 'file',
  colorMode: 'pkg',
  extOn: false,
  crossOnly: false,
  filter: 'all',
  overlay: 'none',
  hlMode: 'direct',
  layoutName: 'dagre',
};

const DependencyGraph: React.FC = () => {
  const c = useClaudeTokens();
  const { mode } = useThemeMode();
  const dispatch = useAppDispatch();

  const data = useAppSelector((s) => s.depgraph.data);
  const loading = useAppSelector((s) => s.depgraph.loading);
  const error = useAppSelector((s) => s.depgraph.error);

  const [controls, setControls] = useState<ControlsState>(DEFAULT_CONTROLS);
  const [inspector, setInspector] = useState<InspectorData | null>(null);
  const [meta, setMeta] = useState('');
  const [search, setSearch] = useState('');
  const [pathArmed, setPathArmed] = useState(false);

  const cyRef = useRef<cytoscape.Core | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const pathModeRef = useRef(false);
  const pathSrcRef = useRef<cytoscape.NodeSingular | null>(null);
  const controlsRef = useRef(controls);
  const pkgColorMapRef = useRef<Record<string, string>>({});

  const pkgColorMap = useMemo(() => {
    if (!data) return {};
    const els = controls.view === 'file' ? data.fileElements : data.pkgElements;
    return buildPkgColorMap(els);
  }, [data, controls.view]);

  useEffect(() => {
    if (!data && !loading) dispatch(scanGraph());
  }, [data, loading, dispatch]);

  const update = useCallback((partial: Partial<ControlsState>) => {
    setControls((prev) => {
      const next = { ...prev, ...partial };
      // Concentric is incompatible with the compound file view; fall back.
      if (next.view === 'file' && !LAYOUTS[next.layoutName].compound) next.layoutName = 'dagre';
      return next;
    });
  }, []);

  const layoutDisabled = useCallback(
    (l: LayoutName) => controls.view === 'file' && !LAYOUTS[l].compound,
    [controls.view],
  );

  // --- Imperative helpers bound to current state via refs --------------------
  const openInspectorFor = useCallback(
    (n: cytoscape.NodeSingular) => {
      setInspector(ops.buildInspectorData(n, data?.layers || {}));
    },
    [data],
  );

  const reapplyOverlay = useCallback((cy: cytoscape.Core) => {
    const o = controlsRef.current.overlay;
    if (o === 'violations') setMeta(ops.showViolations(cy));
    else if (o === 'cycles') setMeta(ops.showCycles(cy));
  }, []);

  // Node tap / background tap delegate through a ref so the listener (bound
  // once) always sees current control state. Mirrored in an effect so we never
  // mutate refs during render.
  const handlersRef = useRef({
    onNodeTap: (_n: cytoscape.NodeSingular) => {},
    onBgTap: () => {},
  });

  useEffect(() => {
    controlsRef.current = controls;
    pkgColorMapRef.current = pkgColorMap;
    handlersRef.current.onNodeTap = (n: cytoscape.NodeSingular) => {
      const cy = cyRef.current;
      if (!cy) return;
      if (pathModeRef.current) {
        if (!pathSrcRef.current) {
          pathSrcRef.current = n;
          ops.clearHighlight(cy);
          cy.elements().addClass('faded');
          n.removeClass('faded').addClass('hl-node');
          setMeta('path: now click the TARGET node');
        } else {
          setMeta(ops.showPath(cy, pathSrcRef.current, n));
          pathSrcRef.current = null;
          pathModeRef.current = false;
          setPathArmed(false);
        }
        return;
      }
      ops.applyNodeHighlight(cy, n, controlsRef.current.hlMode === 'transitive');
      openInspectorFor(n);
    };
    handlersRef.current.onBgTap = () => {
      const cy = cyRef.current;
      if (!cy || pathModeRef.current) return;
      ops.clearHighlight(cy);
      setInspector(null);
      setMeta(ops.computeMeta(cy));
      reapplyOverlay(cy);
    };
  });

  // --- Init cytoscape once ---------------------------------------------------
  useEffect(() => {
    if (!containerRef.current || cyRef.current) return;
    const cy = cytoscape({
      container: containerRef.current,
      elements: [],
      style: buildGraphStyle(GRAPH_THEME[mode]),
      wheelSensitivity: 0.2,
    });
    // Promote the most-recently-interacted node (or its whole group, for a
    // compound card) above every other element and keep it there. A bumped
    // z-index orders peers at the same compound depth; lifting the group's
    // z-compound-depth to 'top' is what lets a card sit above other cards'
    // children (which otherwise always paint above any parent box).
    let zTop = 1;
    let activeGroup: cytoscape.NodeCollection | null = null;
    const bringToFront = (n: cytoscape.NodeSingular) => {
      const root = n.isChild() ? n.parent().first() : n;
      const grp = root.isParent() ? root.union(root.descendants()) : root;
      zTop += 1;
      activeGroup?.style('z-compound-depth', 'auto');
      grp.style({ 'z-index': zTop, 'z-compound-depth': 'top' });
      activeGroup = grp;
    };
    cy.on('tap', 'node', (e) => {
      const n = e.target as cytoscape.NodeSingular;
      bringToFront(n);
      if (n.data('isParent')) return;
      handlersRef.current.onNodeTap(n);
    });
    cy.on('tap', (e) => {
      if (e.target === cy) handlersRef.current.onBgTap();
    });
    cy.on('grab', 'node', (e) => {
      bringToFront(e.target as cytoscape.NodeSingular);
    });
    cyRef.current = cy;
    return () => {
      cy.destroy();
      cyRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Rebuild elements on data / view / ext change --------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    setInspector(null);
    pathSrcRef.current = null;
    pathModeRef.current = false;
    setPathArmed(false);
    cy.elements().remove();
    cy.add(ops.currentElements(data, controls.view, controls.extOn));
    ops.assignVisuals(cy, controls.colorMode, pkgColorMapRef.current);
    ops.applyFilter(cy, controls.filter);
    ops.applyEdgeFilters(cy, controls.crossOnly);
    ops.runLayout(cy, controls.layoutName);
    setMeta(ops.computeMeta(cy));
    reapplyOverlay(cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, controls.view, controls.extOn]);

  // --- Restyle on theme change -----------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.style(buildGraphStyle(GRAPH_THEME[mode]));
  }, [mode]);

  // --- Recolor on colorMode change -------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    ops.assignVisuals(cy, controls.colorMode, pkgColorMapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.colorMode]);

  // --- Re-filter on filter / cross change ------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    ops.clearHighlight(cy);
    ops.applyFilter(cy, controls.filter);
    ops.applyEdgeFilters(cy, controls.crossOnly);
    ops.runLayout(cy, controls.layoutName);
    setMeta(ops.computeMeta(cy));
    reapplyOverlay(cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.filter, controls.crossOnly]);

  // --- Re-layout on layout change --------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    ops.clearHighlight(cy);
    ops.runLayout(cy, controls.layoutName);
    setMeta(ops.computeMeta(cy));
    reapplyOverlay(cy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.layoutName]);

  // --- Apply overlay ----------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    if (controls.overlay === 'violations') setMeta(ops.showViolations(cy));
    else if (controls.overlay === 'cycles') setMeta(ops.showCycles(cy));
    else {
      ops.clearHighlight(cy);
      setMeta(ops.computeMeta(cy));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [controls.overlay]);

  // --- Search -----------------------------------------------------------------
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !data) return;
    ops.applySearch(cy, search);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // --- Inspector actions ------------------------------------------------------
  const withNode = (fn: (cy: cytoscape.Core, n: cytoscape.NodeSingular) => void) => {
    const cy = cyRef.current;
    if (!cy || !inspector) return;
    const n = cy.getElementById(inspector.id) as cytoscape.NodeSingular;
    if (!n || n.empty()) return;
    fn(cy, n);
  };

  const onBlast = () => withNode((cy, n) => ops.applyNodeHighlight(cy, n, true));
  const onIsolate = () => withNode((cy, n) => setMeta(ops.isolate(cy, n, controlsRef.current.layoutName)));
  const onPath = () =>
    withNode((cy, n) => {
      pathModeRef.current = true;
      pathSrcRef.current = n;
      setPathArmed(true);
      setInspector(null);
      ops.clearHighlight(cy);
      cy.elements().addClass('faded');
      n.removeClass('faded').addClass('hl-node');
      setMeta('path: now click the TARGET node');
    });
  const onClearAll = () => {
    const cy = cyRef.current;
    if (!cy) return;
    ops.clearHighlight(cy);
    cy.elements().removeClass('hidden');
    ops.applyFilter(cy, controlsRef.current.filter);
    ops.applyEdgeFilters(cy, controlsRef.current.crossOnly);
    setInspector(null);
    ops.runLayout(cy, controlsRef.current.layoutName);
    setMeta(ops.computeMeta(cy));
    reapplyOverlay(cy);
  };
  const onFocusFromList = (id: string) => {
    const cy = cyRef.current;
    if (!cy) return;
    const t = cy.getElementById(id) as cytoscape.NodeSingular;
    if (!t || t.empty()) return;
    t.removeClass('hidden');
    cy.animate({ center: { eles: t }, duration: 200 });
    ops.applyNodeHighlight(cy, t, controlsRef.current.hlMode === 'transitive');
    openInspectorFor(t);
  };

  const showEmpty = data?.empty;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, bgcolor: c.bg.page }}>
      {/* Toolbar */}
      <Box
        sx={{
          flex: '0 0 auto',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
          px: 2,
          py: 1,
          borderBottom: `1px solid ${c.border.subtle}`,
          bgcolor: c.bg.surface,
        }}
      >
        <Box
          component="input"
          type="search"
          placeholder="search nodes…"
          value={search}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
          sx={{
            width: 220,
            padding: '6px 10px',
            border: `1px solid ${c.border.strong}`,
            borderRadius: `${c.radius.md}px`,
            fontSize: '0.8rem',
            bgcolor: c.bg.page,
            color: c.text.primary,
            outline: 'none',
            '&::placeholder': { color: c.text.muted },
          }}
        />
        <Typography sx={{ fontSize: '0.75rem', color: pathArmed ? c.accent.primary : c.text.tertiary }}>{meta}</Typography>
        <Box sx={{ flex: 1 }} />
        {data?.root && (
          <Typography sx={{ fontSize: '0.72rem', color: c.text.muted, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {data.root}
          </Typography>
        )}
        <IconButton
          size="small"
          onClick={() => dispatch(scanGraph())}
          disabled={loading}
          title="Rescan project"
          sx={{ color: c.text.tertiary, '&:hover': { color: c.accent.primary } }}
        >
          <RefreshIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: '1 1 auto', display: 'flex', minHeight: 0 }}>
        <GraphControls controls={controls} update={update} stats={data?.stats || null} layoutDisabled={layoutDisabled} />

        <Box sx={{ flex: '1 1 auto', position: 'relative', minWidth: 0 }}>
          <Box ref={containerRef} sx={{ position: 'absolute', inset: 0, bgcolor: GRAPH_THEME[mode].canvas }} />

          {loading && (
            <Box sx={overlaySx(c)}>
              <CircularProgress size={22} sx={{ color: c.text.tertiary }} />
              <Typography sx={{ fontSize: '0.85rem', color: c.text.secondary, mt: 1.5 }}>Scanning project…</Typography>
            </Box>
          )}

          {!loading && error && (
            <Box sx={overlaySx(c)}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: c.text.primary }}>Scan failed</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: c.text.tertiary, mt: 1, maxWidth: 360, textAlign: 'center' }}>
                {error}
              </Typography>
              <Button
                onClick={() => dispatch(scanGraph())}
                sx={{
                  mt: 2,
                  px: 2.5,
                  height: 34,
                  bgcolor: c.accent.primary,
                  color: '#fff',
                  textTransform: 'none',
                  fontSize: '0.82rem',
                  borderRadius: `${c.radius.md}px`,
                  '&:hover': { bgcolor: c.accent.hover },
                }}
              >
                Retry
              </Button>
            </Box>
          )}

          {!loading && !error && showEmpty && (
            <Box sx={overlaySx(c)}>
              <Typography sx={{ fontSize: '0.95rem', fontWeight: 600, color: c.text.primary }}>No Python modules found</Typography>
              <Typography sx={{ fontSize: '0.82rem', color: c.text.tertiary, mt: 1, maxWidth: 380, textAlign: 'center' }}>
                Nothing to graph under this project root.
              </Typography>
            </Box>
          )}
        </Box>

        {inspector && (
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.18 }}
            style={{ display: 'flex', minHeight: 0 }}
          >
            <GraphInspector
              node={inspector}
              onClose={() => {
                setInspector(null);
                const cy = cyRef.current;
                if (cy) {
                  ops.clearHighlight(cy);
                  reapplyOverlay(cy);
                }
              }}
              onBlast={onBlast}
              onIsolate={onIsolate}
              onPath={onPath}
              onClear={onClearAll}
              onFocus={onFocusFromList}
            />
          </motion.div>
        )}
      </Box>
    </Box>
  );
};

const overlaySx = (c: ReturnType<typeof useClaudeTokens>) => ({
  position: 'absolute' as const,
  inset: 0,
  display: 'flex',
  flexDirection: 'column' as const,
  alignItems: 'center',
  justifyContent: 'center',
  bgcolor: `${c.bg.page}cc`,
  zIndex: 10,
});

export default DependencyGraph;
