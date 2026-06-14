"""Scan a project root and build an interactive dependency graph payload.

Ported from the standalone ``dependency-graph`` tool, adapted to operate on the
*same* project root the rest of swarm-debug uses (``get_root_dir()``) instead of
a single configured package. Import resolution is therefore **root-relative and
multi-package**: any module whose top-level segment matches a package/module
that actually exists under the root is treated as internal, so it "just works"
whether the root is a single package or a repo containing several.

The result mirrors the JSON the old HTML template consumed (Cytoscape elements
for the file view, the package view, the third-party overlay, plus project
stats), so the React page can render it directly.
"""

from __future__ import annotations

import ast
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

# Directory names that never contain first-party source worth graphing.
SKIP_PARTS: Set[str] = {
    ".venv", "venv", "env", "__pycache__", "node_modules", ".git", ".hg", ".svn",
    ".mypy_cache", ".pytest_cache", ".ruff_cache", ".tox", "dist", "build",
    "site-packages", ".eggs", ".idea", ".vscode", ".cursor",
}

STDLIB: Set[str] = set(getattr(sys, "stdlib_module_names", set()))


def _skip(path: Path) -> bool:
    return any(p in SKIP_PARTS or (p.startswith(".") and len(p) > 1) for p in path.parts)


def iter_source_files(root: Path):
    for path in sorted(root.rglob("*.py")):
        rel = path.relative_to(root)
        if _skip(rel):
            continue
        yield path


def module_name(path: Path, root: Path) -> str:
    """Map a file path to its dotted module name (drops a trailing __init__)."""
    parts = path.relative_to(root).with_suffix("").parts
    if parts and parts[-1] == "__init__":
        parts = parts[:-1]
    return ".".join(parts)


def build_module_map(root: Path) -> Dict[str, Path]:
    return {module_name(p, root): p for p in iter_source_files(root) if module_name(p, root)}


def top_level_names(module_map: Dict[str, Path]) -> Set[str]:
    """First path segment of every known module — what counts as 'internal'."""
    return {mod.split(".")[0] for mod in module_map}


def resolve(mod: str, module_map: Dict[str, Path]) -> Optional[str]:
    """Resolve a dotted import target to a known module.

    Handles ``from pkg.sub import thing`` where ``thing`` is a submodule and
    where ``thing`` is a symbol defined in ``pkg.sub``.
    """
    if mod in module_map:
        return mod
    parent = mod.rsplit(".", 1)[0] if "." in mod else ""
    if parent in module_map:
        return parent
    return None


def analyze_file(
    path: Path, module_map: Dict[str, Path], internal: Set[str]
) -> Tuple[Set[str], Set[str]]:
    """Return ``(internal_modules, external_top_level_packages)`` imported."""
    try:
        tree = ast.parse(path.read_text(encoding="utf-8"), filename=str(path))
    except (SyntaxError, UnicodeDecodeError, ValueError):
        return set(), set()

    deps: Set[str] = set()
    exts: Set[str] = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.ImportFrom):
            if node.level or not node.module:  # skip relative imports
                continue
            top = node.module.split(".")[0]
            if top in internal:
                for alias in node.names:
                    target = resolve(f"{node.module}.{alias.name}", module_map) \
                        or resolve(node.module, module_map)
                    if target:
                        deps.add(target)
            elif top and top not in STDLIB:
                exts.add(top)
        elif isinstance(node, ast.Import):
            for alias in node.names:
                top = alias.name.split(".")[0]
                if top in internal:
                    target = resolve(alias.name, module_map)
                    if target:
                        deps.add(target)
                elif top and top not in STDLIB:
                    exts.add(top)
    return deps, exts


def build_edges(
    module_map: Dict[str, Path], internal: Set[str]
) -> Tuple[Dict[str, List[str]], Dict[str, List[str]]]:
    file_edges: Dict[str, List[str]] = {}
    ext_edges: Dict[str, List[str]] = {}
    for mod, path in module_map.items():
        deps, exts = analyze_file(path, module_map, internal)
        file_edges[mod] = sorted(d for d in deps if d != mod)
        ext_edges[mod] = sorted(exts)
    return file_edges, ext_edges


def package_of(mod: str) -> str:
    """``a.b.c`` -> ``a/b``; a top-level module -> ``(root)``."""
    parts = mod.split(".")
    return "/".join(parts[:-1]) or "(root)"


def short(mod: str) -> str:
    """Leaf label: the module's basename (the package box shows the path)."""
    return mod.split(".")[-1] or mod


def build_package_edges(file_edges: Dict[str, List[str]]) -> Dict[str, Set[str]]:
    pkg_edges: Dict[str, Set[str]] = {}
    for src, dsts in file_edges.items():
        s = package_of(src)
        pkg_edges.setdefault(s, set())
        for d in dsts:
            t = package_of(d)
            if s != t:
                pkg_edges[s].add(t)
    return pkg_edges


def strongly_connected(edges) -> Dict[str, int]:
    """Map each node in a non-trivial SCC (a cycle) to a component id."""
    all_nodes: Set[str] = set(edges)
    for targets in edges.values():
        all_nodes.update(targets)
    adj = {n: list(edges.get(n, [])) for n in all_nodes}

    sys.setrecursionlimit(max(10_000, len(all_nodes) * 10))
    index: Dict[str, int] = {}
    low: Dict[str, int] = {}
    on_stack: Set[str] = set()
    stack: List[str] = []
    sccs: List[List[str]] = []
    counter = [0]

    def dfs(v: str) -> None:
        index[v] = low[v] = counter[0]
        counter[0] += 1
        stack.append(v)
        on_stack.add(v)
        for w in adj[v]:
            if w not in index:
                dfs(w)
                low[v] = min(low[v], low[w])
            elif w in on_stack:
                low[v] = min(low[v], index[w])
        if low[v] == index[v]:
            comp: List[str] = []
            while True:
                w = stack.pop()
                on_stack.discard(w)
                comp.append(w)
                if w == v:
                    break
            sccs.append(comp)

    for node in all_nodes:
        if node not in index:
            dfs(node)

    self_loops = {n for n, targets in edges.items() if n in targets}
    result: Dict[str, int] = {}
    sid = 0
    for comp in sccs:
        if len(comp) > 1 or comp[0] in self_loops:
            for n in comp:
                result[n] = sid
            sid += 1
    return result


def layer_rank(pkg_path: str, layers: Dict[str, int]) -> int:
    if not layers:
        return 0
    return layers.get(pkg_path.split("/")[0], max(layers.values(), default=0) + 1)


def to_elements(edges, grouped: bool, layers: Dict[str, int]) -> List[dict]:
    """Build Cytoscape elements (nodes + edges) from an adjacency map."""
    indeg: Dict[str, int] = {}
    outdeg: Dict[str, int] = {}
    all_nodes: Set[str] = set(edges)
    for src, dsts in edges.items():
        targets = set(dsts)
        outdeg[src] = len(targets)
        for d in targets:
            all_nodes.add(d)
            indeg[d] = indeg.get(d, 0) + 1
    for n in all_nodes:
        indeg.setdefault(n, 0)
        outdeg.setdefault(n, 0)

    scc = strongly_connected(edges)
    nodes: Dict[str, dict] = {}

    def ensure(node_id: str):
        if node_id in nodes:
            return
        label = node_id if grouped else short(node_id)
        data = {
            "id": node_id,
            "label": label,
            "indeg": indeg[node_id],
            "outdeg": outdeg[node_id],
            "pkg": node_id if grouped else package_of(node_id),
            "scc": scc.get(node_id, -1),
        }
        if not grouped:
            data["parent"] = package_of(node_id)
        nodes[node_id] = {"data": data}

    parents: Dict[str, dict] = {}
    edge_elems: List[dict] = []
    for src, dsts in edges.items():
        ensure(src)
        if not grouped:
            pkg = package_of(src)
            parents.setdefault(pkg, {"data": {"id": pkg, "label": pkg, "isParent": True}})
        for d in dsts:
            ensure(d)
            if not grouped:
                pkg = package_of(d)
                parents.setdefault(pkg, {"data": {"id": pkg, "label": pkg, "isParent": True}})
            src_pkg = src if grouped else package_of(src)
            dst_pkg = d if grouped else package_of(d)
            violation = layer_rank(src_pkg, layers) < layer_rank(dst_pkg, layers)
            in_cycle = scc.get(src, -1) != -1 and scc.get(src) == scc.get(d)
            edge_elems.append({"data": {
                "source": src, "target": d,
                "violation": violation, "cycle": in_cycle,
                "samePkg": src_pkg == dst_pkg,
            }})

    return list(parents.values()) + list(nodes.values()) + edge_elems


def to_ext_elements(ext_edges: Dict[str, List[str]]) -> List[dict]:
    """Overlay elements for third-party dependencies (nodes + edges)."""
    indeg: Dict[str, int] = {}
    for exts in ext_edges.values():
        for name in exts:
            indeg[name] = indeg.get(name, 0) + 1

    nodes = [
        {"data": {"id": f"ext:{name}", "label": name, "indeg": count,
                  "outdeg": 0, "pkg": "(external)", "isExt": True}}
        for name, count in sorted(indeg.items())
    ]
    edges = [
        {"data": {"source": mod, "target": f"ext:{name}",
                  "violation": False, "cycle": False, "samePkg": False}}
        for mod, exts in ext_edges.items()
        for name in exts
    ]
    return nodes + edges


def _longest_chain(file_edges: Dict[str, List[str]], nodes: Set[str]) -> int:
    """Longest dependency chain (node count) in the import DAG; cycle-safe."""
    memo: Dict[str, int] = {}
    state: Dict[str, int] = {}

    def dfs(n: str) -> int:
        if n in memo:
            return memo[n]
        if state.get(n) == 0:  # back-edge into a cycle; stop descending
            return 0
        state[n] = 0
        best = 0
        for d in file_edges.get(n, []):
            best = max(best, dfs(d))
        state[n] = 1
        memo[n] = 1 + best
        return memo[n]

    return max((dfs(n) for n in nodes), default=0)


def compute_stats(
    file_edges: Dict[str, List[str]], ext_edges: Dict[str, List[str]], layers: Dict[str, int]
) -> dict:
    nodes = set(file_edges) | {d for ds in file_edges.values() for d in ds}
    indeg = {n: 0 for n in nodes}
    outdeg = {n: 0 for n in nodes}
    for s, ds in file_edges.items():
        outdeg[s] = len(ds)
        for d in ds:
            indeg[d] += 1

    packages = {package_of(n) for n in nodes}
    externals = {n for exts in ext_edges.values() for n in exts}
    violations = sum(
        1 for s, ds in file_edges.items() for d in ds
        if layer_rank(package_of(s), layers) < layer_rank(package_of(d), layers)
    )
    scc = strongly_connected(file_edges)
    cycle_count = len(set(scc.values()))

    def top(metric: Dict[str, int], k: int = 6):
        ranked = sorted(metric.items(), key=lambda kv: (-kv[1], kv[0]))
        return [[short(n), v] for n, v in ranked[:k] if v > 0]

    return {
        "modules": len(nodes),
        "imports": sum(len(v) for v in file_edges.values()),
        "packages": len(packages),
        "externals": len(externals),
        "violations": violations,
        "cycles": cycle_count,
        "singleImporters": sum(1 for n in nodes if indeg[n] == 1),
        "orphans": sum(1 for n in nodes if indeg[n] == 0),
        "leaves": sum(1 for n in nodes if outdeg[n] == 0),
        "longestChain": _longest_chain(file_edges, nodes),
        "topHubs": top(indeg),
        "topOrchestrators": top(outdeg),
    }


def scan_root(root: str, layers: Optional[Dict[str, int]] = None) -> dict:
    """Scan ``root`` and return the full dependency-graph payload.

    ``layers`` optionally maps a top-level package name to a layer rank for
    layer-violation detection; an edge from a lower rank to a higher rank is a
    violation. Defaults to ``{}`` (violation detection disabled).
    """
    layers = layers or {}
    root_path = Path(root).resolve()

    module_map = build_module_map(root_path)
    if not module_map:
        return {
            "fileElements": [], "pkgElements": [], "extElements": [],
            "stats": compute_stats({}, {}, layers),
            "layers": layers, "root": str(root_path),
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "empty": True,
        }

    internal = top_level_names(module_map)
    file_edges, ext_edges = build_edges(module_map, internal)
    pkg_edges = build_package_edges(file_edges)
    stats = compute_stats(file_edges, ext_edges, layers)

    return {
        "fileElements": to_elements(file_edges, grouped=False, layers=layers),
        "pkgElements": to_elements(
            {k: sorted(v) for k, v in pkg_edges.items()}, grouped=True, layers=layers
        ),
        "extElements": to_ext_elements(ext_edges),
        "stats": stats,
        "layers": layers,
        "root": str(root_path),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "empty": False,
    }
