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
  // root-relative POSIX file path (file view leaves only); join key with the
  // debugger tree, whose file ids are `root/<path>`.
  path?: string;
  // folder-view compound boxes (one per directory prefix). `depth` is 0 for a
  // top-level folder; `fileCount` counts the leaves anywhere beneath it;
  // `clabel` is the collapsed label (folder name + file count).
  isFolder?: boolean;
  depth?: number;
  fileCount?: number;
  clabel?: string;
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
  // folder-view aggregated edge: bundles `metaCount` underlying file edges
  // between the two collapsed-folder representatives.
  meta?: boolean;
  metaCount?: number;
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

export interface PathFilter {
  // Glob patterns (comma-separated entries allowed). Empty include = match all;
  // exclude always wins over include.
  include: string[];
  exclude: string[];
  // Expand the matched set by one dependency hop (importers + imports).
  growHops: boolean;
}

export type FilterTab = 'expr' | 'picker';

export type GraphView = 'file' | 'pkg' | 'folder';
export type ColorMode = 'pkg' | 'inst';
export type FilterMode = 'all' | 'single' | 'orphan' | 'leaf' | 'hub';
export type LayoutName = 'dagre' | 'fcose' | 'concentric';
export type OverlayMode = 'none' | 'violations' | 'cycles' | 'coverage';

/** Whether a graph node's file has debug output enabled, disabled, or no `debug()` calls at all. */
export type DebugState = 'on' | 'off' | 'none';
export type HighlightMode = 'direct' | 'transitive';
/** Which edges to highlight when a node is clicked: both directions, only what it imports, or only what imports it. */
export type EdgeDir = 'both' | 'imports' | 'importedBy';

export interface InspectorData {
  id: string;
  label: string;
  path?: string;
  pkg: string;
  layer: string;
  indeg: number;
  outdeg: number;
  instability: number;
  isExt: boolean;
  // folder-view compound box: lists immediate children and aggregated deps.
  isFolder?: boolean;
  collapsed?: boolean;
  childCount?: number;
  fileCount?: number;
  imports: { id: string; label: string }[];
  importers: { id: string; label: string }[];
}
