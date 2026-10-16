import { graphData, NODE_H, NODE_W } from '../lib/graph';
import { href } from '../lib/router';
import { useCatalog } from '../components/ui';

const PAD = 16;

export function GraphPage() {
  const { catalog } = useCatalog();
  const { nodes, edges, width, height } = graphData(catalog.index);
  return (
    <>
      <h1>Dependency graph</h1>
      <p className="lede">
        Arrows point from a plugin to what it needs, labelled with the version range it declares.
        Installing a plugin also installs everything it points at, directly or further along. Plugins
        with no dependencies are on the left. Click a plugin to open it.
      </p>
      <div className="graph-wrap">
        <svg
          className="graph"
          viewBox={`${-PAD} ${-PAD} ${width + PAD * 2} ${height + PAD * 2}`}
          role="img"
          aria-label={`${nodes.length} plugins, ${edges.length} dependencies`}
          data-testid="graph"
        >
          <defs>
            <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 10 5 0 10z" className="graph-arrow" />
            </marker>
          </defs>
          {edges.map((e) => (
            <g key={`${e.from}->${e.to}`} className="graph-edge" data-testid="graph-edge">
              <path d={e.path} markerEnd="url(#arrow)" />
              <text x={e.label.x} y={e.label.y} textAnchor="end">{e.range}</text>
            </g>
          ))}
          {nodes.map((n) => (
            <a key={n.name} href={href('plugin', n.name)} className="graph-node" data-testid="graph-node">
              <rect x={n.x} y={n.y} width={NODE_W} height={NODE_H} rx="8" />
              <text x={n.x + NODE_W / 2} y={n.y + 24} textAnchor="middle" className="graph-name">{n.name}</text>
              <text x={n.x + NODE_W / 2} y={n.y + 42} textAnchor="middle" className="graph-version">v{n.version}</text>
            </a>
          ))}
        </svg>
      </div>
    </>
  );
}
