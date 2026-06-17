import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { DebugState, InspectorData } from '@/types/depgraph';

interface Props {
  node: InspectorData;
  debugState: DebugState;
  onClose: () => void;
  onBlast: () => void;
  onIsolate: () => void;
  onPath: () => void;
  onClear: () => void;
  onFocus: (id: string) => void;
  onDebugToggle: () => void;
  onDebugImports: () => void;
  onDebugImporters: () => void;
  onToggleCollapse: () => void;
}

const GraphInspector: React.FC<Props> = ({
  node,
  debugState,
  onClose,
  onBlast,
  onIsolate,
  onPath,
  onClear,
  onFocus,
  onDebugToggle,
  onDebugImports,
  onDebugImporters,
  onToggleCollapse,
}) => {
  const c = useClaudeTokens();

  const renderMeta = (k: string, v: string | number) => (
    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1.5, fontSize: '0.72rem', py: 0.15 }}>
      <Typography sx={{ fontSize: 'inherit', color: c.text.muted }}>{k}</Typography>
      <Typography sx={{ fontSize: 'inherit', fontWeight: 600, color: c.text.primary, wordBreak: 'break-all', textAlign: 'right' }}>
        {v}
      </Typography>
    </Box>
  );

  const actionBtnSx = {
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

  const renderList = (title: string, items: { id: string; label: string }[]) => (
    <Box sx={{ mt: 1.25 }}>
      <Typography
        sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: c.text.muted, mb: 0.5 }}
      >
        {title} ({items.length})
      </Typography>
      {items.length === 0 ? (
        <Typography sx={{ fontSize: '0.72rem', color: c.text.muted, px: 0.5 }}>none</Typography>
      ) : (
        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
          {items.map((it) => (
            <Box
              component="li"
              key={it.id}
              onClick={() => onFocus(it.id)}
              sx={{
                px: 1,
                py: 0.5,
                borderRadius: `${c.radius.sm}px`,
                fontSize: '0.72rem',
                color: c.accent.primary,
                cursor: 'pointer',
                wordBreak: 'break-all',
                '&:hover': { bgcolor: `${c.accent.primary}14` },
              }}
            >
              {it.label}
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );

  return (
    <Box
      sx={{
        flex: '0 0 290px',
        borderLeft: `1px solid ${c.border.subtle}`,
        bgcolor: c.bg.surface,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        height: '100%',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1,
          px: 1.75,
          py: 1.25,
          borderBottom: `1px solid ${c.border.subtle}`,
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: c.text.primary, wordBreak: 'break-all' }}>
          {node.label}
        </Typography>
        <IconButton size="small" onClick={onClose} sx={{ color: c.text.tertiary }}>
          <CloseIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Box>

      <Box sx={{ flex: '1 1 auto', overflow: 'auto', px: 1.75, py: 1.5 }}>
        {node.isFolder ? (
          <>
            {renderMeta('Folder', node.pkg)}
            {renderMeta('State', node.collapsed ? 'collapsed' : 'expanded')}
            {renderMeta('Files', node.fileCount ?? 0)}
            {!node.collapsed && renderMeta('Sub-items', node.childCount ?? 0)}
            {renderMeta('Imported by', node.indeg)}
            {renderMeta('Imports', node.outdeg)}
            {renderMeta('Instability', node.instability.toFixed(2))}
          </>
        ) : (
          <>
            {renderMeta('Package', node.pkg)}
            {renderMeta('Layer', node.layer)}
            {renderMeta('Imported by', node.indeg)}
            {renderMeta('Imports', node.outdeg)}
            {renderMeta('Instability', node.instability.toFixed(2))}
          </>
        )}

        <Box sx={{ mt: 1.25, height: 6, borderRadius: `${c.radius.xs}px`, bgcolor: c.bg.elevated, overflow: 'hidden' }}>
          <Box
            sx={{
              height: '100%',
              width: `${Math.round(node.instability * 100)}%`,
              background: 'linear-gradient(90deg,#3a9d8e,#d9a441,#d9603c)',
            }}
          />
        </Box>
        <Typography sx={{ fontSize: '0.6rem', color: c.text.muted, textTransform: 'uppercase', letterSpacing: '0.04em', mt: 0.5 }}>
          stable → unstable
        </Typography>

        {node.isFolder && (
          <Box
            component="button"
            onClick={onToggleCollapse}
            sx={{ ...actionBtnSx, width: '100%', py: 0.8, mt: 1.5, fontWeight: 600 }}
          >
            {node.collapsed ? 'Expand folder' : 'Collapse folder'}
          </Box>
        )}

        {!node.isExt && !node.isFolder && (
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 1.5 }}>
            <Box component="button" onClick={onBlast} sx={actionBtnSx}>Blast radius</Box>
            <Box component="button" onClick={onPath} sx={actionBtnSx}>Trace path…</Box>
            <Box component="button" onClick={onIsolate} sx={actionBtnSx}>Isolate</Box>
            <Box component="button" onClick={onClear} sx={actionBtnSx}>Clear</Box>
          </Box>
        )}

        {!node.isExt && !node.isFolder && (
          <Box sx={{ mt: 1.75, pt: 1.25, borderTop: `1px solid ${c.border.subtle}` }}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.75 }}>
              <Typography sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: c.text.muted }}>
                Debug output
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Box
                  sx={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    bgcolor: debugState === 'on' ? c.status.success : debugState === 'off' ? c.text.muted : 'transparent',
                    border: debugState === 'none' ? `1px solid ${c.border.strong}` : 'none',
                  }}
                />
                <Typography sx={{ fontSize: '0.68rem', color: c.text.tertiary }}>
                  {debugState === 'on' ? 'on' : debugState === 'off' ? 'off' : 'no debug() calls'}
                </Typography>
              </Box>
            </Box>

            {debugState === 'none' ? (
              <Typography sx={{ fontSize: '0.68rem', color: c.text.muted, lineHeight: 1.5 }}>
                This file has no <code>debug()</code> calls, so there is nothing to toggle.
              </Typography>
            ) : (
              <>
                <Box
                  component="button"
                  onClick={onDebugToggle}
                  sx={{
                    ...actionBtnSx,
                    width: '100%',
                    py: 0.7,
                    fontWeight: 600,
                    bgcolor: debugState === 'on' ? `${c.status.success}1f` : c.bg.surface,
                    borderColor: debugState === 'on' ? c.status.success : c.border.strong,
                    color: debugState === 'on' ? c.status.success : c.text.primary,
                    '&:hover': { bgcolor: debugState === 'on' ? `${c.status.success}33` : c.bg.elevated },
                  }}
                >
                  {debugState === 'on' ? 'Turn debug OFF' : 'Turn debug ON'}
                </Box>
                <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mt: 0.75 }}>
                  <Box component="button" onClick={onDebugImports} sx={actionBtnSx} title="Enable debug for this file and everything it imports">
                    ON + imports
                  </Box>
                  <Box component="button" onClick={onDebugImporters} sx={actionBtnSx} title="Enable debug for this file and everything that imports it">
                    ON + importers
                  </Box>
                </Box>
              </>
            )}
          </Box>
        )}

        {renderList('Imports', node.imports)}
        {renderList('Imported by', node.importers)}
      </Box>
    </Box>
  );
};

export default GraphInspector;
