import React from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { GraphStats as Stats } from '@/types/depgraph';

const GraphStats: React.FC<{ stats: Stats }> = ({ stats }) => {
  const c = useClaudeTokens();

  const renderRow = (k: string, v: number, warn?: boolean) => (
    <Box key={k} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', py: 0.1 }}>
      <Typography sx={{ fontSize: 'inherit', color: c.text.secondary }}>{k}</Typography>
      <Typography
        sx={{
          fontSize: 'inherit',
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          color: warn && v > 0 ? c.accent.primary : c.text.primary,
        }}
      >
        {v}
      </Typography>
    </Box>
  );

  const renderList = (title: string, rows: [string, number][]) => (
    <Box sx={{ mt: 1 }}>
      <Typography
        sx={{ fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: c.text.muted, mb: 0.25 }}
      >
        {title}
      </Typography>
      {rows.length === 0 ? (
        <Typography sx={{ fontSize: '0.72rem', color: c.text.muted }}>—</Typography>
      ) : (
        rows.map(([n, v]) => (
          <Box key={n} sx={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
            <Typography sx={{ fontSize: 'inherit', color: c.text.primary, wordBreak: 'break-all' }}>{n}</Typography>
            <Typography sx={{ fontSize: 'inherit', color: c.text.secondary, fontVariantNumeric: 'tabular-nums' }}>{v}</Typography>
          </Box>
        ))
      )}
    </Box>
  );

  return (
    <Box>
      {renderRow('modules', stats.modules)}
      {renderRow('imports', stats.imports)}
      {renderRow('packages', stats.packages)}
      {renderRow('third-party', stats.externals)}
      {renderRow('single-importer', stats.singleImporters)}
      {renderRow('orphans', stats.orphans)}
      {renderRow('leaves', stats.leaves)}
      {renderRow('deepest chain', stats.longestChain)}
      {renderRow('layer violations', stats.violations, true)}
      {renderRow('import cycles', stats.cycles, true)}
      {renderList('Top hubs (fan-in)', stats.topHubs)}
      {renderList('Orchestrators (fan-out)', stats.topOrchestrators)}
    </Box>
  );
};

export default GraphStats;
