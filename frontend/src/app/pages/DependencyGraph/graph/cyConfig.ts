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
    canvas: 'rgb(250,249,245)',
    nodeText: 'rgb(39,36,31)',
    nodeBorder: 'rgb(183,172,152)',
    edge: 'rgb(207,198,178)',
    parentFill1: 'rgb(255,255,255)',
    parentFill2: 'rgb(241,236,225)',
    parentOpacity: 0.8,
    parentBorder: 'rgb(193, 193, 193)',
    parentBorderOpacity: 0.85,
    parentText: 'rgb(107,100,87)',
    extBg: 'rgb(236,231,220)',
    extBorder: 'rgb(196,187,166)',
    extText: 'rgb(107,100,87)',
    hlBg: 'rgb(217,119,87)',
    hlText: 'rgb(255,255,255)',
    hlBorder: 'rgb(196,99,63)',
    inEdge: 'rgb(79,138,91)',
    outEdge: 'rgb(192,83,59)',
    violation: 'rgb(224,132,60)',
    cycle: 'rgb(194,100,160)',
    path: 'rgb(138,111,176)',
    pathText: 'rgb(255,255,255)',
    pathBorder: 'rgb(111,87,154)',
  },
  dark: {
    canvas: 'rgb(31,30,29)',
    nodeText: 'rgb(26,24,21)',
    nodeBorder: 'rgb(92,85,74)',
    edge: 'rgb(74,70,63)',
    parentFill1: 'rgb(84,80,74)',
    parentFill2: 'rgb(51,49,45)',
    parentOpacity: 0.8,
    parentBorder: 'rgb(125,118,106)',
    parentBorderOpacity: 0.6,
    parentText: 'rgb(163,156,141)',
    extBg: 'rgb(47,45,42)',
    extBorder: 'rgb(74,70,63)',
    extText: 'rgb(163,156,141)',
    hlBg: 'rgb(217,119,87)',
    hlText: 'rgb(26,24,21)',
    hlBorder: 'rgb(224,138,108)',
    inEdge: 'rgb(105,176,121)',
    outEdge: 'rgb(224,122,95)',
    violation: 'rgb(232,160,90)',
    cycle: 'rgb(214,131,182)',
    path: 'rgb(169,143,208)',
    pathText: 'rgb(26,24,21)',
    pathBorder: 'rgb(194,174,230)',
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
        // Always paint edges beneath every node (including parent card boxes
        // and the lifted 'top'-depth card), regardless of compound depth.
        'z-compound-depth': 'bottom',
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
  'rgb(194,115,78)', 'rgb(217,164,65)', 'rgb(125,155,106)', 'rgb(207,139,108)', 'rgb(154,140,192)', 'rgb(91,154,160)',
  'rgb(204,127,122)', 'rgb(163,165,87)', 'rgb(224,177,94)', 'rgb(111,155,196)', 'rgb(179,133,176)', 'rgb(127,170,120)',
  'rgb(217,154,143)', 'rgb(95,163,154)', 'rgb(196,137,173)',
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
