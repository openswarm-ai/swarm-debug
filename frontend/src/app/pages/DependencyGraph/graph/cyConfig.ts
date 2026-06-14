import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import { GraphElement, GraphNodeData, LayoutName } from '@/types/depgraph';

let registered = false;
export function registerCytoscapePlugins(): void {
  if (registered) return;
  cytoscape.use(dagre);
  cytoscape.use(fcose);
  registered = true;
}

// Per-theme graph color tokens. Semantic overlay hues are tuned to read on
// both the cream (light) and charcoal (dark) canvases.
export interface GraphTheme {
  canvas: string;
  nodeText: string;
  nodeBorder: string;
  edge: string;
  parentFill1: string;
  parentFill2: string;
  parentOpacity: number;
  parentBorder: string;
  parentBorderOpacity: number;
  parentText: string;
  extBg: string;
  extBorder: string;
  extText: string;
  hlBg: string;
  hlText: string;
  hlBorder: string;
  inEdge: string;
  outEdge: string;
  violation: string;
  cycle: string;
  path: string;
  pathText: string;
  pathBorder: string;
}

export const GRAPH_THEME: Record<'light' | 'dark', GraphTheme> = {
  light: {
    canvas: '#faf9f5',
    nodeText: '#27241f',
    nodeBorder: '#b7ac98',
    edge: '#cfc6b2',
    parentFill1: '#ffffff',
    parentFill2: '#f1ece1',
    parentOpacity: 0.42,
    parentBorder: '#ffffff',
    parentBorderOpacity: 0.85,
    parentText: '#6b6457',
    extBg: '#ece7dc',
    extBorder: '#c4bba6',
    extText: '#6b6457',
    hlBg: '#d97757',
    hlText: '#ffffff',
    hlBorder: '#c4633f',
    inEdge: '#4f8a5b',
    outEdge: '#c0533b',
    violation: '#e0843c',
    cycle: '#c264a0',
    path: '#8a6fb0',
    pathText: '#ffffff',
    pathBorder: '#6f579a',
  },
  dark: {
    canvas: '#1f1e1d',
    nodeText: '#1a1815',
    nodeBorder: '#5c554a',
    edge: '#4a463f',
    parentFill1: '#54504a',
    parentFill2: '#33312d',
    parentOpacity: 0.45,
    parentBorder: '#7d766a',
    parentBorderOpacity: 0.6,
    parentText: '#a39c8d',
    extBg: '#2f2d2a',
    extBorder: '#4a463f',
    extText: '#a39c8d',
    hlBg: '#d97757',
    hlText: '#1a1815',
    hlBorder: '#e08a6c',
    inEdge: '#69b079',
    outEdge: '#e07a5f',
    violation: '#e8a05a',
    cycle: '#d683b6',
    path: '#a98fd0',
    pathText: '#1a1815',
    pathBorder: '#c2aee6',
  },
};

export function buildGraphStyle(t: GraphTheme): cytoscape.StylesheetStyle[] {
  return [
    {
      selector: 'node',
      style: {
        label: 'data(label)',
        'font-size': 11,
        'text-valign': 'center',
        color: t.nodeText,
        'background-color': 'data(color)',
        'border-width': 1,
        'border-color': t.nodeBorder,
        shape: 'round-rectangle',
        width: 'label',
        height: 'label',
        padding: 'data(pad)',
        'text-wrap': 'wrap',
      },
    },
    {
      selector: 'node[?isParent]',
      style: {
        'background-opacity': t.parentOpacity,
        'background-fill': 'linear-gradient',
        'background-gradient-stop-colors': [t.parentFill1, t.parentFill2],
        'background-gradient-stop-positions': [0, 100],
        'background-gradient-direction': 'to-bottom',
        'border-color': t.parentBorder,
        'border-width': 1,
        'border-opacity': t.parentBorderOpacity,
        'text-valign': 'top',
        'font-size': 12,
        'font-weight': 'bold',
        color: t.parentText,
        shape: 'round-rectangle',
        padding: '6px',
      },
    },
    {
      selector: 'edge',
      style: {
        width: 1.2,
        'line-color': t.edge,
        'target-arrow-color': t.edge,
        'target-arrow-shape': 'triangle',
        'curve-style': 'bezier',
        'arrow-scale': 0.9,
      },
    },
    {
      selector: 'node[?isExt]',
      style: {
        'background-color': t.extBg,
        'border-color': t.extBorder,
        'border-style': 'dashed',
        color: t.extText,
        shape: 'diamond',
        'font-size': 10,
      },
    },
    { selector: '.faded', style: { opacity: 0.12 } },
    { selector: '.hidden', style: { display: 'none' } },
    {
      selector: '.hl-node',
      style: { 'background-color': t.hlBg, color: t.hlText, 'border-color': t.hlBorder, 'border-width': 2 },
    },
    { selector: '.hl-in', style: { 'line-color': t.inEdge, 'target-arrow-color': t.inEdge, width: 2 } },
    { selector: '.hl-out', style: { 'line-color': t.outEdge, 'target-arrow-color': t.outEdge, width: 2 } },
    {
      selector: 'edge.violation',
      style: { 'line-color': t.violation, 'target-arrow-color': t.violation, width: 3, 'line-style': 'dashed' },
    },
    {
      selector: 'edge.cycle-el',
      style: { 'line-color': t.cycle, 'target-arrow-color': t.cycle, width: 3, 'line-style': 'dashed' },
    },
    { selector: 'node.cycle-el', style: { 'border-color': t.cycle, 'border-width': 3 } },
    {
      selector: '.path-el',
      style: {
        'line-color': t.path,
        'target-arrow-color': t.path,
        width: 3,
        'background-color': t.path,
        color: t.pathText,
        'border-color': t.pathBorder,
      },
    },
  ];
}

// Warm, earthy categorical palette tuned to sit on both canvases.
const PALETTE = [
  '#c2734e', '#d9a441', '#7d9b6a', '#cf8b6c', '#9a8cc0', '#5b9aa0',
  '#cc7f7a', '#a3a557', '#e0b15e', '#6f9bc4', '#b385b0', '#7faa78',
  '#d99a8f', '#5fa39a', '#c489ad',
];

/** Deterministic package -> color map built from the elements. */
export function buildPkgColorMap(elements: GraphElement[]): Record<string, string> {
  const pkgs = new Set<string>();
  for (const el of elements) {
    const d = el.data as GraphNodeData;
    if (!('source' in el.data) && d.pkg) pkgs.add(d.pkg);
  }
  const map: Record<string, string> = {};
  let i = 0;
  for (const pkg of Array.from(pkgs).sort()) {
    map[pkg] = PALETTE[i % PALETTE.length];
    i++;
  }
  return map;
}

/** Instability I = Ce / (Ca + Ce): 0 = stable, 1 = unstable. */
export function instability(indeg: number, outdeg: number): number {
  return indeg + outdeg === 0 ? 0 : outdeg / (indeg + outdeg);
}

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

/** teal (stable) -> amber (mid) -> red (unstable). */
export function instColor(t: number): string {
  const stops = [
    [20, 184, 166],
    [234, 179, 8],
    [239, 68, 68],
  ];
  const seg = t < 0.5 ? 0 : 1;
  const lt = t < 0.5 ? t / 0.5 : (t - 0.5) / 0.5;
  const a = stops[seg];
  const b = stops[seg + 1];
  return `rgb(${lerp(a[0], b[0], lt)},${lerp(a[1], b[1], lt)},${lerp(a[2], b[2], lt)})`;
}

export function layerOf(
  pkg: string | undefined,
  layers: Record<string, number>,
): { name: string; rank: number | null } | null {
  if (!pkg || pkg === '(external)') return null;
  const name = pkg.indexOf('/') >= 0 ? pkg.split('/')[0] : pkg;
  const rank = name in layers ? layers[name] : '(root)' in layers && pkg === '(root)' ? layers['(root)'] : null;
  return { name, rank };
}

export const LAYOUTS: Record<LayoutName, { compound: boolean; opts: cytoscape.LayoutOptions }> = {
  dagre: {
    compound: true,
    opts: { name: 'dagre', rankDir: 'LR', nodeSep: 18, rankSep: 70, edgeSep: 8 } as unknown as cytoscape.LayoutOptions,
  },
  fcose: {
    compound: true,
    opts: {
      name: 'fcose',
      quality: 'proof',
      randomize: true,
      animate: false,
      nodeSeparation: 90,
      idealEdgeLength: 70,
      nodeRepulsion: 6000,
      packComponents: true,
    } as unknown as cytoscape.LayoutOptions,
  },
  concentric: {
    compound: false,
    opts: {
      name: 'concentric',
      minNodeSpacing: 14,
      equidistant: false,
      concentric: (n: cytoscape.NodeSingular) => (n.data('indeg') || 0) + (n.data('outdeg') || 0),
      levelWidth: () => 2,
    } as cytoscape.LayoutOptions,
  },
};
