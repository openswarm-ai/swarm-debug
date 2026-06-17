import cytoscape from 'cytoscape';
import { GraphEdgeData, GraphElement, GraphNodeData, GraphPayload } from '@/types/depgraph';

/**
 * Folder view. Renders the directory tree as recursively nested compound boxes
 * derived purely from each leaf's root-relative `path`.
 *
 * Collapsing is modeled by OMITTING a collapsed folder's descendants from the
 * graph entirely (rather than hiding them): a collapsed folder is emitted as a
 * childless, normally-sized node, and the import edges crossing its boundary are
 * pre-bundled into aggregated "meta" edges between the visible representatives.
 *
 * This is required because a Cytoscape compound parent has no dimensions of its
 * own -- it is sized from its (displayed) descendants. Merely hiding the
 * children leaves the parent with no bounding box, so it renders as nothing.
 * Removing the children makes the folder a regular node that sizes to its label.
 */

const isEdge = (e: GraphElement): boolean => 'source' in e.data;

/** Directory prefixes of a POSIX path: `a/b/c.py` -> [`a`, `a/b`]. */
function dirPrefixes(path: string): string[] {
  const segs = path.split('/');
  segs.pop(); // drop the filename
  const out: string[] = [];
  let acc = '';
  for (const seg of segs) {
    acc = acc ? `${acc}/${seg}` : seg;
    out.push(acc);
  }
  return out;
}

const basename = (p: string): string => p.split('/').pop() || p;
const depthOf = (dir: string): number => dir.split('/').length - 1;

/** Strict ancestor dir prefixes of a folder id (`a/b/c` -> [`a`, `a/b`]). */
function ancestorDirs(id: string): string[] {
  const segs = id.split('/');
  const out: string[] = [];
  let acc = '';
  for (let i = 0; i < segs.length - 1; i += 1) {
    acc = acc ? `${acc}/${segs[i]}` : segs[i];
    out.push(acc);
  }
  return out;
}

/**
 * Build Cytoscape elements for the folder view under the given collapse set.
 *
 * Nodes:
 *  - folder boxes that are not inside a collapsed folder (collapsed ones are
 *    emitted childless so they render as a single sized node),
 *  - file leaves that are not inside a collapsed folder,
 *  - external nodes (when `extOn`).
 * Edges:
 *  - real file edges whose endpoints are both visible (kept verbatim),
 *  - one aggregated meta edge per (representative source -> representative
 *    target) pair for every edge crossing a collapsed boundary.
 */
export function buildFolderElements(
  data: GraphPayload,
  extOn: boolean,
  collapsed: Set<string>,
): cytoscape.ElementDefinition[] {
  const folders = new Map<string, GraphNodeData>();
  const fileCounts = new Map<string, number>();
  const leafData = new Map<string, GraphNodeData>();
  const pathById = new Map<string, string>();
  const realEdges: GraphEdgeData[] = [];

  for (const el of data.fileElements) {
    if (isEdge(el)) {
      realEdges.push(el.data as GraphEdgeData);
      continue;
    }
    const node = el.data as GraphNodeData;
    // The payload's file-view parent boxes (isParent, label = full dir path, no
    // `path`) are not leaves. We rebuild the directory tree ourselves from each
    // leaf's `path`, so skip them -- otherwise they'd be emitted as top-level,
    // parent-stripped empty boxes that no collapse ever absorbs.
    if (node.isParent) continue;
    leafData.set(node.id, node);
    if (node.path) pathById.set(node.id, node.path);
    const prefixes = node.path ? dirPrefixes(node.path) : [];
    prefixes.forEach((pre, i) => {
      if (!folders.has(pre)) {
        folders.set(pre, {
          id: pre,
          label: basename(pre),
          isParent: true,
          isFolder: true,
          depth: depthOf(pre),
          parent: i > 0 ? prefixes[i - 1] : undefined,
          pkg: pre,
        });
      }
      fileCounts.set(pre, (fileCounts.get(pre) || 0) + 1);
    });
  }
  for (const [id, f] of folders) {
    f.fileCount = fileCounts.get(id) || 0;
    f.clabel = `${f.label} (${f.fileCount})`;
  }

  const extNodes: GraphNodeData[] = [];
  if (extOn) {
    for (const el of data.extElements) {
      if (isEdge(el)) realEdges.push(el.data as GraphEdgeData);
      else extNodes.push(el.data as GraphNodeData);
    }
  }

  // The visible node that stands in for a leaf: its outermost collapsed ancestor
  // directory, or the leaf itself when none of its ancestors are collapsed.
  const repOf = (id: string): string => {
    const path = pathById.get(id);
    if (!path) return id; // external or unknown -> itself
    let best: string | null = null;
    let bestDepth = Infinity;
    for (const pre of dirPrefixes(path)) {
      if (collapsed.has(pre) && depthOf(pre) < bestDepth) {
        bestDepth = depthOf(pre);
        best = pre;
      }
    }
    return best ?? id;
  };
  const folderAbsorbed = (id: string): boolean => ancestorDirs(id).some((a) => collapsed.has(a));

  // ---- nodes ----
  const nodes: cytoscape.ElementDefinition[] = [];
  for (const [id, f] of folders) {
    if (folderAbsorbed(id)) continue; // inside a collapsed folder -> omitted
    nodes.push({ data: { ...f } });
  }
  for (const [id, node] of leafData) {
    if (repOf(id) !== id) continue; // absorbed by a collapsed ancestor -> omitted
    const prefixes = node.path ? dirPrefixes(node.path) : [];
    const parentDir = prefixes.length ? prefixes[prefixes.length - 1] : undefined;
    nodes.push({ data: { ...node, parent: parentDir } });
  }
  for (const e of extNodes) nodes.push({ data: { ...e } });

  // ---- edges ----
  interface Bucket {
    source: string;
    target: string;
    count: number;
    violation: boolean;
    cycle: boolean;
  }
  const buckets = new Map<string, Bucket>();
  const edges: cytoscape.ElementDefinition[] = [];
  for (const ed of realEdges) {
    const ru = repOf(ed.source);
    const rv = repOf(ed.target);
    if (ru === rv) continue; // internal to a collapsed folder -> dropped
    if (ru === ed.source && rv === ed.target) {
      edges.push({ data: { ...ed } }); // both endpoints visible -> real edge
      continue;
    }
    const key = `${ru}\u0000${rv}`;
    const b = buckets.get(key);
    if (b) {
      b.count += 1;
      b.violation = b.violation || !!ed.violation;
      b.cycle = b.cycle || !!ed.cycle;
    } else {
      buckets.set(key, { source: ru, target: rv, count: 1, violation: !!ed.violation, cycle: !!ed.cycle });
    }
  }
  for (const b of buckets.values()) {
    edges.push({
      data: {
        id: `meta\u0000${b.source}\u0000${b.target}`,
        source: b.source,
        target: b.target,
        meta: true,
        metaCount: b.count,
        violation: b.violation,
        cycle: b.cycle,
        samePkg: false,
      },
    });
  }

  return [...nodes, ...edges];
}

/**
 * Pure list of every folder (directory prefix) and its depth, derived from the
 * payload's file paths. Used to seed the default collapse set and to drive the
 * expand-all / collapse-all / collapse-to-depth controls without a cy instance.
 */
export function folderDepths(data: GraphPayload): { id: string; depth: number }[] {
  const seen = new Map<string, number>();
  for (const el of data.fileElements) {
    if (isEdge(el)) continue;
    const path = (el.data as GraphNodeData).path;
    if (!path) continue;
    for (const pre of dirPrefixes(path)) seen.set(pre, depthOf(pre));
  }
  return Array.from(seen, ([id, depth]) => ({ id, depth }));
}
