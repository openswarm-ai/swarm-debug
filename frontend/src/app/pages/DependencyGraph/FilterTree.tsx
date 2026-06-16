import React, { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Checkbox from '@mui/material/Checkbox';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { useClaudeTokens } from '@/shared/styles/ThemeContext';
import { useAppSelector } from '@/shared/hooks';
import { GraphNodeData } from '@/types/depgraph';

interface Props {
  // Active include globs. A folder contributes `${rel}/**`, a file contributes `${rel}`.
  include: string[];
  onChange: (include: string[]) => void;
}

interface FileTreeNode {
  name: string;
  rel: string;
  children?: FileTreeNode[]; // present => directory
}

const globFor = (rel: string, dir: boolean) => (dir ? `${rel}/**` : rel);

/** Drop any include entries nested under `rel` (a folder we just selected). */
const stripDescendants = (include: string[], rel: string) =>
  include.filter((g) => g !== `${rel}/**` && !g.startsWith(`${rel}/`));

/** Build a nested folder/file tree from root-relative POSIX paths. */
function buildPathTree(paths: string[]): FileTreeNode[] {
  const root: FileTreeNode = { name: '', rel: '', children: [] };
  for (const path of paths) {
    const segments = path.split('/');
    let cur = root;
    segments.forEach((seg, i) => {
      const isLeaf = i === segments.length - 1;
      const rel = cur.rel ? `${cur.rel}/${seg}` : seg;
      let next = cur.children!.find((ch) => ch.name === seg);
      if (!next) {
        next = isLeaf ? { name: seg, rel } : { name: seg, rel, children: [] };
        cur.children!.push(next);
      }
      cur = next;
    });
  }
  const sortRec = (node: FileTreeNode) => {
    if (!node.children) return;
    node.children.sort((a, b) => {
      const aDir = !!a.children;
      const bDir = !!b.children;
      if (aDir !== bDir) return aDir ? -1 : 1; // directories first
      return a.name.localeCompare(b.name);
    });
    node.children.forEach(sortRec);
  };
  sortRec(root);
  return root.children!;
}

const FilterTree: React.FC<Props> = ({ include, onChange }) => {
  const c = useClaudeTokens();
  const data = useAppSelector((s) => s.depgraph.data);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Source the picker from the graph itself, so it offers exactly the files
  // present as nodes (every file-view leaf carries a root-relative `path`).
  const tree = useMemo(() => {
    const paths = (data?.fileElements ?? [])
      .map((e) => (e.data as GraphNodeData).path)
      .filter((p): p is string => !!p);
    return buildPathTree(Array.from(new Set(paths)));
  }, [data]);

  if (tree.length === 0) {
    return <Typography sx={{ fontSize: '0.7rem', color: c.text.muted }}>No files to pick from.</Typography>;
  }

  const includeSet = new Set(include);

  const toggle = (rel: string, dir: boolean, checked: boolean) => {
    const glob = globFor(rel, dir);
    if (checked) {
      // Selecting a folder supersedes any narrower selections beneath it.
      const base = dir ? stripDescendants(include, rel) : include.filter((g) => g !== glob);
      onChange([...base, glob]);
    } else {
      onChange(include.filter((g) => g !== glob));
    }
  };

  const renderNode = (node: FileTreeNode, depth: number): React.ReactNode => {
    const dir = !!node.children;
    const glob = globFor(node.rel, dir);
    const checked = includeSet.has(glob);
    // Indeterminate: a descendant (or the folder-glob) is selected but not this exact box.
    const partial = !checked && include.some((g) => g === `${node.rel}/**` || g.startsWith(`${node.rel}/`));
    const open = !!expanded[node.rel];

    return (
      <Box key={node.rel}>
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            pl: `${depth * 12}px`,
            py: 0.15,
            borderRadius: `${c.radius.sm}px`,
            '&:hover': { bgcolor: c.bg.elevated },
          }}
        >
          <Box
            sx={{ width: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: dir ? 'pointer' : 'default' }}
            onClick={() => dir && setExpanded((e) => ({ ...e, [node.rel]: !e[node.rel] }))}
          >
            {dir && (
              <ChevronRightIcon
                sx={{ fontSize: 15, color: c.text.tertiary, transform: open ? 'rotate(90deg)' : 'none', transition: 'transform 150ms ease' }}
              />
            )}
          </Box>
          <Checkbox
            checked={checked}
            indeterminate={partial}
            onChange={(e) => toggle(node.rel, dir, e.target.checked)}
            size="small"
            sx={{
              p: 0,
              color: c.text.tertiary,
              '&.Mui-checked': { color: c.accent.primary },
              '&.MuiCheckbox-indeterminate': { color: c.accent.primary },
            }}
          />
          <Typography
            onClick={() => dir && setExpanded((e) => ({ ...e, [node.rel]: !e[node.rel] }))}
            sx={{
              fontSize: '0.74rem',
              fontFamily: c.font.mono,
              fontWeight: dir ? 600 : 400,
              color: c.text.primary,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              cursor: dir ? 'pointer' : 'default',
            }}
          >
            {node.name}
          </Typography>
        </Box>
        {dir && open && node.children!.map((ch) => renderNode(ch, depth + 1))}
      </Box>
    );
  };

  return (
    <Box
      sx={{
        maxHeight: 240,
        overflowY: 'auto',
        overflowX: 'hidden',
        border: `1px solid ${c.border.subtle}`,
        borderRadius: `${c.radius.md}px`,
        py: 0.5,
        scrollbarWidth: 'thin',
        scrollbarColor: `${c.border.strong} transparent`,
        '&::-webkit-scrollbar': { width: 8 },
        '&::-webkit-scrollbar-thumb': { backgroundColor: c.border.strong, borderRadius: `${c.radius.full}px` },
      }}
    >
      {tree.map((n) => renderNode(n, 0))}
    </Box>
  );
};

export default FilterTree;
