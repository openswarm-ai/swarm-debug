export interface GraphNodeData {
  id: string;
  label: string;
  indeg?: number;
  outdeg?: number;
  pkg?: string;
  scc?: number;
  parent?: string;
  isParent?: boolean;
  isExt?: boolean;
  // assigned client-side
  color?: string;
  pad?: number;
}

export interface GraphEdgeData {
  source: string;
  target: string;
  violation?: boolean;
  cycle?: boolean;
  samePkg?: boolean;
}

export interface GraphElement {
  data: GraphNodeData | GraphEdgeData;
}

export interface GraphStats {
  modules: number;
  imports: number;
  packages: number;
  externals: number;
  violations: number;
  cycles: number;
  singleImporters: number;
  orphans: number;
  leaves: number;
  longestChain: number;
  topHubs: [string, number][];
  topOrchestrators: [string, number][];
}

export interface GraphPayload {
  fileElements: GraphElement[];
  pkgElements: GraphElement[];
  extElements: GraphElement[];
  stats: GraphStats;
  layers: Record<string, number>;
  root: string;
  generatedAt: string;
  empty: boolean;
}

export type GraphView = 'file' | 'pkg';
export type ColorMode = 'pkg' | 'inst';
export type FilterMode = 'all' | 'single' | 'orphan' | 'leaf' | 'hub';
export type LayoutName = 'dagre' | 'fcose' | 'concentric';
export type OverlayMode = 'none' | 'violations' | 'cycles';
export type HighlightMode = 'direct' | 'transitive';

export interface InspectorData {
  id: string;
  label: string;
  pkg: string;
  layer: string;
  indeg: number;
  outdeg: number;
  instability: number;
  isExt: boolean;
  imports: { id: string; label: string }[];
  importers: { id: string; label: string }[];
}
