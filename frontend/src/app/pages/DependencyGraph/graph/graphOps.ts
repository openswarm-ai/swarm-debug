import cytoscape from 'cytoscape';
import {
  ColorMode,
  EdgeDir,
  FilterMode,
  GraphElement,
  GraphPayload,
  GraphView,
  InspectorData,
  LayoutName,
  PathFilter,
} from '@/types/depgraph';
import { instColor, instability, LAYOUTS, layerOf } from './cyConfig';
import { isPathFilterEmpty, makePathMatcher } from './glob';
import { buildFolderElements } from './folderView';

/** Fresh, mutable element copies (redux state is frozen; cytoscape mutates). */
export function currentElements(
  data: GraphPayload,
  view: GraphView,
  extOn: boolean,
  collapsed: Set<string>,
): cytoscape.ElementDefinition[] {
  if (view === 'folder') return buildFolderElements(data, extOn, collapsed);
  const base = view === 'file' ? data.fileElements : data.pkgElements;
  const all: GraphElement[] = view === 'file' && extOn ? base.concat(data.extElements) : base;
  return all.map((e) => ({ data: { ...e.data } }));
}

export function assignVisuals(cy: cytoscape.Core, colorMode: ColorMode, pkgColorMap: Record<string, string>): void {
  const leaves = cy.nodes('[!isParent]');
  let maxIn = 1;
  leaves.forEach((n) => {
    maxIn = Math.max(maxIn, n.data('indeg') || 0);
  });
  leaves.forEach((n) => {
    const color = colorMode === 'inst' ? instColor(instability(n.data('indeg') || 0, n.data('outdeg') || 0)) : pkgColorMap[n.data('pkg')] || '#c2734e';
    n.data('color', color);
    n.data('pad', Math.round(6 + ((n.data('indeg') || 0) / maxIn) * 20));
  });
  cy.nodes('[?isParent]').forEach((p) => {
    p.data('pad', 6);
  });
}

export function clearHighlight(cy: cytoscape.Core): void {
  cy.elements().removeClass('faded hl-node hl-in hl-out violation cycle-el path-el debug-on');
}

/** Leaves surviving the degree-based `filter` dropdown. */
function degreeVisible(leaves: cytoscape.NodeCollection, kind: FilterMode): cytoscape.NodeCollection {
  if (kind === 'single') return leaves.filter((n) => n.data('indeg') === 1);
  if (kind === 'orphan') return leaves.filter((n) => n.data('indeg') === 0);
  if (kind === 'leaf') return leaves.filter((n) => n.data('outdeg') === 0);
  if (kind === 'hub') {
    let maxIn = 0;
    leaves.forEach((n) => {
      maxIn = Math.max(maxIn, n.data('indeg'));
    });
    const thr = Math.max(2, Math.ceil(maxIn * 0.5));
    return leaves.filter((n) => n.data('indeg') >= thr);
  }
  return leaves;
}

/** Leaves surviving the path include/exclude globs. Externals are exempt (they
 *  are governed by the External toggle, not the path filter). */
function pathVisible(
  leaves: cytoscape.NodeCollection,
  view: GraphView,
  pathFilter: PathFilter,
): cytoscape.NodeCollection {
  if (isPathFilterEmpty(pathFilter.include, pathFilter.exclude)) return leaves;
  const match = makePathMatcher(pathFilter.include, pathFilter.exclude);
  let visible = leaves.filter((n) => {
    if (n.data('isExt')) return true;
    const key = view === 'file' || view === 'folder' ? n.data('path') : n.data('id');
    return key ? match(String(key)) : true;
  });
  if (pathFilter.growHops) {
    const grown = visible.union(visible.incomers('node')).union(visible.outgoers('node'));
    visible = grown.intersection(leaves);
  }
  return visible;
}

export interface VisibilityOpts {
  view: GraphView;
  filter: FilterMode;
  crossOnly: boolean;
  pathFilter: PathFilter;
}

/**
 * Single source of truth for the `hidden` class. Combines every active filter
 * dimension (degree filter ∧ path globs ∧ cross-package edges) so the dimensions
 * never clobber one another, then prunes orphaned edges and empty parent boxes.
 *
 * Folder collapse is NOT handled here: it is baked into the element set by
 * `buildFolderElements` (collapsed subtrees are omitted), so a collapsed folder
 * is a childless node and is naturally untouched by the parent-box prune below.
 */
export function recomputeVisibility(cy: cytoscape.Core, opts: VisibilityOpts): void {
  const leaves = cy.nodes('[!isParent]');
  cy.elements().removeClass('hidden');

  const visible = degreeVisible(leaves, opts.filter).intersection(
    pathVisible(leaves, opts.view, opts.pathFilter),
  );
  leaves.difference(visible).addClass('hidden');

  cy.edges().forEach((e) => {
    if (e.source().hasClass('hidden') || e.target().hasClass('hidden')) e.addClass('hidden');
    else if (opts.crossOnly && e.data('samePkg')) e.addClass('hidden');
  });

  // Prune empty boxes deepest-first so a parent sees its children's updated
  // hidden state. Uses the structural `:parent` selector, so collapsed folders
  // (which are childless) are never pruned.
  const boxes = cy.nodes(':parent').sort((a, b) => (b.data('depth') ?? 0) - (a.data('depth') ?? 0));
  boxes.forEach((p) => {
    if (p.children().filter((ch) => !ch.hasClass('hidden')).length === 0) p.addClass('hidden');
  });
}

export function runLayout(cy: cytoscape.Core, layoutName: LayoutName): void {
  const preset = LAYOUTS[layoutName] || LAYOUTS.dagre;
  const opts = Object.assign({ fit: true, padding: 30 }, preset.opts);
  cy.elements(':visible').layout(opts).run();
}

export function computeMeta(cy: cytoscape.Core): string {
  const total = cy.nodes('[!isParent]').length;
  const shown = cy.nodes('[!isParent]').filter(':visible').length;
  const edges = cy.edges().filter(':visible').length;
  const suffix = shown === total ? '' : ` of ${total}`;
  return `${shown} nodes${suffix} \u00b7 ${edges} edges`;
}

export function showViolations(cy: cytoscape.Core): string {
  clearHighlight(cy);
  const bad = cy.edges().filter((e) => e.data('violation') && e.visible());
  if (bad.length === 0) return 'no layer violations in view';
  cy.elements().addClass('faded');
  const keep = bad.union(bad.connectedNodes());
  keep.union(keep.ancestors()).removeClass('faded');
  bad.addClass('violation');
  return `${bad.length} layer violation${bad.length > 1 ? 's' : ''} (dependency pointing up)`;
}

export function showCycles(cy: cytoscape.Core): string {
  clearHighlight(cy);
  const loop = cy.edges().filter((e) => e.data('cycle') && e.visible());
  if (loop.length === 0) return 'no import cycles in view';
  const nodes = loop.connectedNodes();
  cy.elements().addClass('faded');
  const keep = loop.union(nodes);
  keep.union(keep.ancestors()).removeClass('faded');
  loop.addClass('cycle-el');
  nodes.addClass('cycle-el');
  const groups = new Set(nodes.map((n) => n.data('scc')));
  return `${groups.size} import cycle${groups.size > 1 ? 's' : ''} (${nodes.length} modules)`;
}

/** Highlight every in-view file whose debug output is currently toggled ON. */
export function showCoverage(cy: cytoscape.Core, toggledPaths: Set<string>): string {
  clearHighlight(cy);
  const leaves = cy.nodes('[!isParent]').filter(':visible');
  const instrumentable = leaves.filter((n) => !!n.data('path'));
  const on = instrumentable.filter((n) => toggledPaths.has(String(n.data('path'))));
  if (on.length === 0) {
    return instrumentable.length === 0
      ? 'no instrumentable files in view'
      : 'no debug output enabled in view';
  }
  cy.elements().addClass('faded');
  on.union(on.ancestors()).removeClass('faded');
  on.addClass('debug-on');
  // Emphasize edges connecting two instrumented-and-on files (the live subgraph).
  on.edgesWith(on).removeClass('faded').addClass('debug-on');
  return `${on.length} of ${instrumentable.length} file${instrumentable.length > 1 ? 's' : ''} emitting debug output`;
}

export function applyNodeHighlight(
  cy: cytoscape.Core,
  n: cytoscape.NodeSingular,
  transitive: boolean,
  dir: EdgeDir = 'both',
): void {
  clearHighlight(cy);
  const empty = cy.collection();
  // Edges point importer -> imported, so outgoers are this node's imports and
  // incomers are the files that import it.
  const inc = dir === 'imports' ? empty : transitive ? n.predecessors() : n.incomers();
  const out = dir === 'importedBy' ? empty : transitive ? n.successors() : n.outgoers();
  const keep = n.union(inc).union(out);
  cy.elements().addClass('faded');
  keep.union(keep.ancestors()).removeClass('faded');
  n.addClass('hl-node');
  inc.edges().addClass('hl-in');
  out.edges().addClass('hl-out');
}

export function showPath(cy: cytoscape.Core, src: cytoscape.NodeSingular, dst: cytoscape.NodeSingular): string {
  const res = cy.elements().aStar({ root: src, goal: dst, directed: true });
  clearHighlight(cy);
  cy.elements().addClass('faded');
  if (!res.found) {
    const ends = src.union(dst);
    ends.ancestors().removeClass('faded');
    ends.removeClass('faded').addClass('hl-node');
    return `no path: ${src.data('label')} \u2192 ${dst.data('label')}`;
  }
  res.path.ancestors().removeClass('faded');
  res.path.removeClass('faded hidden').addClass('path-el');
  return `path: ${src.data('label')} \u2192 ${dst.data('label')} (${res.path.edges().length} hops)`;
}

export function isolate(cy: cytoscape.Core, n: cytoscape.NodeSingular, layoutName: LayoutName): string {
  let keep = n.union(n.incomers()).union(n.outgoers());
  keep = keep.union(keep.parents());
  cy.elements().addClass('hidden');
  keep.removeClass('hidden');
  clearHighlight(cy);
  n.addClass('hl-node');
  runLayout(cy, layoutName);
  return `isolated ${n.data('label')} (${keep.nodes('[!isParent]').length - 1} neighbors)`;
}

export function applySearch(cy: cytoscape.Core, query: string): void {
  const q = query.trim().toLowerCase();
  clearHighlight(cy);
  if (!q) return;
  const matched = cy.nodes('[!isParent]').filter((n) => String(n.data('label')).toLowerCase().includes(q));
  if (matched.length === 0) return;
  cy.elements().addClass('faded');
  const keep = matched.union(matched.connectedEdges()).union(matched.connectedEdges().connectedNodes());
  keep.union(keep.ancestors()).removeClass('faded');
  matched.addClass('hl-node');
}

/**
 * Root-relative file paths for every node in `coll` whose file actually calls
 * `debug()` (i.e. is present in `instrumented`). Used to bulk-toggle debug
 * output across a dependency closure or traced path.
 */
export function instrumentablePaths(coll: cytoscape.NodeCollection, instrumented: Set<string>): string[] {
  const out: string[] = [];
  coll.forEach((n) => {
    const p = n.data('path');
    if (p && instrumented.has(String(p))) out.push(String(p));
  });
  return Array.from(new Set(out));
}

export function buildInspectorData(n: cytoscape.NodeSingular, layers: Record<string, number>): InspectorData {
  const pkg = n.data('pkg') || '';
  const lyr = layerOf(pkg, layers);
  const isExt = !!n.data('isExt');
  const layer = isExt ? '\u2014' : lyr ? `${lyr.name}${lyr.rank != null ? ` (L${lyr.rank})` : ''}` : '\u2014';

  const toItems = (coll: cytoscape.NodeCollection) =>
    coll
      .map((x) => ({ id: x.id(), label: String(x.data('label')) }))
      .sort((a, b) => a.label.localeCompare(b.label));

  if (n.data('isFolder')) {
    // Aggregate the subtree's boundary-crossing edges. This works whether the
    // folder is expanded (real + nested-meta edges among its descendants) or
    // collapsed (the folder node itself is the endpoint of its meta edges).
    const cy = n.cy();
    const sub = n.union(n.descendants());
    const ids = new Set<string>();
    sub.forEach((x) => {
      ids.add(x.id());
    });
    const importTargets = new Set<string>();
    const importerSources = new Set<string>();
    sub.connectedEdges().forEach((e) => {
      const fromInside = ids.has(e.source().id());
      const toInside = ids.has(e.target().id());
      if (fromInside && !toInside) importTargets.add(e.target().id());
      if (toInside && !fromInside) importerSources.add(e.source().id());
    });
    const toItemsFromIds = (set: Set<string>) =>
      Array.from(set)
        .map((id) => ({ id, label: String(cy.getElementById(id).data('label')) }))
        .sort((a, b) => a.label.localeCompare(b.label));
    const indeg = importerSources.size;
    const outdeg = importTargets.size;
    return {
      id: n.id(),
      label: String(n.data('label')),
      pkg: n.id(),
      layer,
      indeg,
      outdeg,
      instability: instability(indeg, outdeg),
      isExt: false,
      isFolder: true,
      collapsed: n.isChildless(),
      childCount: n.children().length,
      fileCount: n.data('fileCount') || 0,
      imports: toItemsFromIds(importTargets),
      importers: toItemsFromIds(importerSources),
    };
  }

  const indeg = n.data('indeg') || 0;
  const outdeg = n.data('outdeg') || 0;
  return {
    id: n.id(),
    label: String(n.data('label')),
    path: n.data('path') ? String(n.data('path')) : undefined,
    pkg,
    layer,
    indeg,
    outdeg,
    instability: instability(indeg, outdeg),
    isExt,
    imports: toItems(n.outgoers('node')),
    importers: toItems(n.incomers('node')),
  };
}
