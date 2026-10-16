// Dependency graph layout (SITE-SPEC AC-8): one node per plugin, one edge per declared dependency.
// Layered left to right: plugins with no dependencies in column 0, each dependent one column past
// its deepest dependency. Edges leave a dependent's left side and enter a dependency's right side,
// each at its own port so labels do not collide; an edge that skips a column bends around the
// nodes in between instead of crossing them.
import type { Index } from '../types';

export interface GraphNode {
  name: string;
  version: string;
  layer: number;
  x: number;
  y: number;
}

export interface GraphEdge {
  from: string; // dependent
  to: string; // dependency
  range: string;
  path: string;
  label: { x: number; y: number };
}

export const NODE_W = 200;
export const NODE_H = 56;
const GAP_X = 110;
const GAP_Y = 28;
/** Room above and below the nodes for edges that bend around a column. */
export const DETOUR = 44;

export function graphData(index: Index) {
  const byName = new Map(index.plugins.map((p) => [p.name, p]));
  const layer = new Map<string, number>();
  const depth = (name: string, seen = new Set<string>()): number => {
    if (layer.has(name)) return layer.get(name)!;
    if (seen.has(name)) return 0; // cycle: check-manifests rejects these; do not loop here
    seen.add(name);
    const deps = (byName.get(name)?.dependencies ?? []).filter((d) => byName.has(d.name));
    const l = deps.length ? 1 + Math.max(...deps.map((d) => depth(d.name, seen))) : 0;
    layer.set(name, l);
    return l;
  };
  index.plugins.forEach((p) => depth(p.name));

  const columns: string[][] = [];
  for (const p of index.plugins) (columns[layer.get(p.name)!] ??= []).push(p.name);
  const tallest = Math.max(...columns.map((c) => c?.length ?? 0));
  const nodesHeight = tallest * NODE_H + (tallest - 1) * GAP_Y;

  const nodes: GraphNode[] = [];
  columns.forEach((col, l) => {
    const colHeight = col.length * NODE_H + (col.length - 1) * GAP_Y;
    col.forEach((name, i) => {
      nodes.push({
        name,
        version: byName.get(name)!.version,
        layer: l,
        x: l * (NODE_W + GAP_X),
        y: DETOUR + (nodesHeight - colHeight) / 2 + i * (NODE_H + GAP_Y),
      });
    });
  });
  const at = new Map(nodes.map((n) => [n.name, n]));
  const raw = index.plugins.flatMap((p) =>
    p.dependencies.filter((d) => byName.has(d.name)).map((d) => ({ from: p.name, to: d.name, range: d.version })),
  );

  // Ports: spread each node's outgoing (left side) and incoming (right side) edges over its height,
  // ordered by the other end's position so edges do not cross at the node.
  const port = (list: typeof raw, key: 'from' | 'to', other: 'from' | 'to') => {
    const out = new Map<(typeof raw)[number], number>();
    for (const n of nodes) {
      const mine = list.filter((e) => e[key] === n.name).sort((a, b) => at.get(a[other])!.y - at.get(b[other])!.y);
      mine.forEach((e, i) => out.set(e, n.y + (NODE_H * (i + 1)) / (mine.length + 1)));
    }
    return out;
  };
  const outY = port(raw, 'from', 'to');
  const inY = port(raw, 'to', 'from');
  const midY = DETOUR + nodesHeight / 2;

  const edges: GraphEdge[] = raw.map((e) => {
    const a = at.get(e.from)!;
    const b = at.get(e.to)!;
    const x1 = a.x, y1 = outY.get(e)!, x2 = b.x + NODE_W, y2 = inY.get(e)!;
    let path: string;
    if (a.layer - b.layer <= 1) {
      const mx = (x1 + x2) / 2;
      path = `M${x1} ${y1} C${mx} ${y1} ${mx} ${y2} ${x2} ${y2}`;
    } else {
      // Skip the columns in between: go out over the top (or under the bottom) of the graph.
      const yOut = y2 <= midY ? 6 : DETOUR * 2 + nodesHeight - 6;
      const xa = x1 - GAP_X / 2, xb = x2 + GAP_X / 2;
      path = `M${x1} ${y1} C${xa} ${y1} ${xa} ${yOut} ${xa - 40} ${yOut} L${xb + 40} ${yOut} C${xb} ${yOut} ${xb} ${y2} ${x2} ${y2}`;
    }
    return { ...e, path, label: { x: x1 - 8, y: y1 - 5 } };
  });
  return { nodes, edges, width: columns.length * NODE_W + (columns.length - 1) * GAP_X, height: nodesHeight + DETOUR * 2 };
}
