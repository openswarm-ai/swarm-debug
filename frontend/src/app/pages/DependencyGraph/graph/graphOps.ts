import cytoscape from 'cytoscape';
import {
  ColorMode,
  FilterMode,
  GraphElement,
  GraphPayload,
  GraphView,
  InspectorData,
  LayoutName,
} from '@/types/depgraph';
import { instColor, instability, LAYOUTS, layerOf } from './cyConfig';

/** Fresh, mutable element copies (redux state is frozen; cytoscape mutates). */
export function currentElements(data: GraphPayload, view: GraphView, extOn: boolean): cytoscape.ElementDefinition[] {
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
  cy.elements().removeClass('faded hl-node hl-in hl-out violation cycle-el path-el');
}

export function applyFilter(cy: cytoscape.Core, kind: FilterMode): void {
  const leaves = cy.nodes('[!isParent]');
  cy.elements().removeClass('hidden');
  if (kind === 'all') return;
  let visible: cytoscape.NodeCollection;
  if (kind === 'single') visible = leaves.filter((n) => n.data('indeg') === 1);
  else if (kind === 'orphan') visible = leaves.filter((n) => n.data('indeg') === 0);
  else if (kind === 'leaf') visible = leaves.filter((n) => n.data('outdeg') === 0);
  else if (kind === 'hub') {
    let maxIn = 0;
    leaves.forEach((n) => {
      maxIn = Math.max(maxIn, n.data('indeg'));
    });
    const thr = Math.max(2, Math.ceil(maxIn * 0.5));
    visible = leaves.filter((n) => n.data('indeg') >= thr);
  } else visible = leaves;
  leaves.difference(visible).addClass('hidden');
  cy.edges().forEach((e) => {
    if (e.source().hasClass('hidden') || e.target().hasClass('hidden')) e.addClass('hidden');
  });
  cy.nodes('[?isParent]').forEach((p) => {
    if (p.children().filter((ch) => !ch.hasClass('hidden')).length === 0) p.addClass('hidden');
  });
}

export function applyEdgeFilters(cy: cytoscape.Core, crossOnly: boolean): void {
  if (!crossOnly) return;
  cy.edges().forEach((e) => {
    if (e.data('samePkg')) e.addClass('hidden');
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
  bad.union(bad.connectedNodes()).removeClass('faded');
  bad.addClass('violation');
  return `${bad.length} layer violation${bad.length > 1 ? 's' : ''} (dependency pointing up)`;
}

export function showCycles(cy: cytoscape.Core): string {
  clearHighlight(cy);
  const loop = cy.edges().filter((e) => e.data('cycle') && e.visible());
  if (loop.length === 0) return 'no import cycles in view';
  const nodes = loop.connectedNodes();
  cy.elements().addClass('faded');
  loop.union(nodes).removeClass('faded');
  loop.addClass('cycle-el');
  nodes.addClass('cycle-el');
  const groups = new Set(nodes.map((n) => n.data('scc')));
  return `${groups.size} import cycle${groups.size > 1 ? 's' : ''} (${nodes.length} modules)`;
}

export function applyNodeHighlight(cy: cytoscape.Core, n: cytoscape.NodeSingular, transitive: boolean): void {
  clearHighlight(cy);
  const inc = transitive ? n.predecessors() : n.incomers();
  const out = transitive ? n.successors() : n.outgoers();
  const keep = n.union(inc).union(out);
  cy.elements().addClass('faded');
  keep.removeClass('faded');
  n.addClass('hl-node');
  inc.edges().addClass('hl-in');
  out.edges().addClass('hl-out');
}

export function showPath(cy: cytoscape.Core, src: cytoscape.NodeSingular, dst: cytoscape.NodeSingular): string {
  const res = cy.elements().aStar({ root: src, goal: dst, directed: true });
  clearHighlight(cy);
  cy.elements().addClass('faded');
  if (!res.found) {
    src.union(dst).removeClass('faded').addClass('hl-node');
    return `no path: ${src.data('label')} \u2192 ${dst.data('label')}`;
  }
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
  keep.removeClass('faded');
  matched.addClass('hl-node');
}

export function buildInspectorData(n: cytoscape.NodeSingular, layers: Record<string, number>): InspectorData {
  const pkg = n.data('pkg') || '';
  const lyr = layerOf(pkg, layers);
  const indeg = n.data('indeg') || 0;
  const outdeg = n.data('outdeg') || 0;
  const isExt = !!n.data('isExt');
  const layer = isExt ? '\u2014' : lyr ? `${lyr.name}${lyr.rank != null ? ` (L${lyr.rank})` : ''}` : '\u2014';

  const toItems = (coll: cytoscape.NodeCollection) =>
    coll
      .map((x) => ({ id: x.id(), label: String(x.data('label')) }))
      .sort((a, b) => a.label.localeCompare(b.label));

  return {
    id: n.id(),
    label: String(n.data('label')),
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
