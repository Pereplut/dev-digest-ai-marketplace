import type { Index, PluginRow } from '../types';
import { href } from '../lib/router';
import { useBody } from '../lib/data';
import { channelVersion, installCommand } from '../lib/commands';
import { Badge, Command, Markdown, TokenBadge, formatTokens, useCatalog } from '../components/ui';
import { NotFound } from './NotFound';

function blobBase(index: Index, plugin: PluginRow) {
  return `https://github.com/${index.marketplace.repo}/blob/main/${plugin.path}/`;
}

/** Transitive dependency tree, with the declared range on every edge (SITE-SPEC AC-4). */
function DepTree({ name, index, seen = new Set<string>() }: { name: string; index: Index; seen?: Set<string> }) {
  const p = index.plugins.find((x) => x.name === name);
  if (!p || p.dependencies.length === 0) return null;
  return (
    <ul className="tree">
      {p.dependencies.map((d) => {
        const dep = index.plugins.find((x) => x.name === d.name);
        const cycle = seen.has(d.name);
        return (
          <li key={d.name}>
            <a href={href('plugin', d.name)}>{d.name}</a> <code>{d.version}</code>
            {dep && <span className="muted"> (current v{dep.version})</span>}
            {!cycle && <DepTree name={d.name} index={index} seen={new Set([...seen, name])} />}
          </li>
        );
      })}
    </ul>
  );
}

export function PluginPage({ name }: { name: string }) {
  const { catalog, channel } = useCatalog();
  const { index, stats, releases } = catalog;
  const plugin = index.plugins.find((p) => p.name === name);
  const readme = useBody(plugin?.readmePath);
  if (!plugin) return <NotFound what={`plugin “${name}”`} />;
  const components = index.artifacts.filter((a) => a.plugin === plugin.name);
  const s = stats.plugins[plugin.name];
  const version = channelVersion(plugin, channel);
  const latestRelease = releases.find((r) => r.plugin === plugin.name);

  return (
    <div className="detail">
      <nav className="crumbs"><a href="#/">Catalog</a> / {plugin.name}</nav>
      <header className="detail-head">
        <h1>{plugin.name}</h1>
        <span className="version" data-testid="plugin-version">v{plugin.version}</span>
        {plugin.category && <Badge kind="category">{plugin.category}</Badge>}
      </header>
      <p className="lede">{plugin.description}</p>

      <div className="detail-grid">
        <section className="panel">
          <h2>Install</h2>
          {channel === 'stable' && !version ? (
            <p className="warn">Not pinned on the stable channel yet. Switch to latest, or wait for the first promotion.</p>
          ) : (
            <p className="muted">{channel === 'stable' ? `Stable channel pins v${version}.` : 'Latest channel: the version on main.'}</p>
          )}
          <Command text={installCommand(index, plugin.name, channel)} testId="copy-install" />
          {plugin.dependencies.length > 0 && <p className="muted small">Its dependencies install automatically.</p>}
        </section>

        <section className="panel">
          <h2>Details</h2>
          <dl className="facts">
            <dt>Version</dt><dd>{plugin.version}{latestRelease?.date && <span className="muted"> · {latestRelease.date}</span>}</dd>
            <dt>Owner</dt><dd>{plugin.author?.url ? <a href={plugin.author.url} rel="noopener noreferrer">{plugin.author.name}</a> : plugin.author?.name ?? '—'}</dd>
            <dt>License</dt><dd>{plugin.license ?? '—'}</dd>
            <dt>Claude Code</dt><dd>{plugin.minClaudeCode ? `>= ${plugin.minClaudeCode}` : 'not stated'}{plugin.testedOn && <span className="muted"> · tested on {plugin.testedOn.replace(/^Claude Code /, '')}</span>}</dd>
            <dt>Source</dt><dd><a href={`https://github.com/${index.marketplace.repo}/tree/main/${plugin.path}`} target="_blank" rel="noopener noreferrer">{plugin.path}</a></dd>
          </dl>
        </section>

        <section className="panel">
          <h2>Dependencies</h2>
          {plugin.dependencies.length === 0 ? <p className="muted">None.</p> : (
            <div data-testid="dependencies"><DepTree name={plugin.name} index={index} /></div>
          )}
          {plugin.dependents.length > 0 && (
            <p className="small">Required by {plugin.dependents.map((d, i) => <span key={d}>{i > 0 && ', '}<a href={href('plugin', d)}>{d}</a></span>)}</p>
          )}
        </section>

        <section className="panel">
          <h2>Context cost</h2>
          <dl className="facts">
            <dt>Always loaded</dt><dd>~{formatTokens(s.discoveryTokens)} tokens of descriptions</dd>
            <dt>On use</dt><dd>~{formatTokens(s.tokens)} tokens if every component loads</dd>
          </dl>
          <p className="muted small">Estimates ({stats.method}). Manual-only skills are not listed to the model, so they cost nothing until you run them.</p>
        </section>
      </div>

      <section>
        <h2 className="section-title">Components</h2>
        <div className="table-wrap">
          <table className="table" data-testid="components">
            <thead><tr><th>Name</th><th>Type</th><th>Invoke</th><th>Size</th></tr></thead>
            <tbody>
              {components.map((a) => (
                <tr key={a.id}>
                  <td><a href={href('artifact', a.id)}>{a.name}</a>{a.manual && <span className="pill">manual</span>}</td>
                  <td><Badge kind={a.type}>{a.type}</Badge></td>
                  <td><code>{a.invocation}</code></td>
                  <td><TokenBadge id={a.id} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="section-title">README</h2>
        {readme.error ? <p className="warn">Could not load the README: {readme.error}</p>
          : readme.text == null ? <p className="muted">Loading…</p>
          : <Markdown md={readme.text} linkBase={blobBase(index, plugin)} />}
      </section>
    </div>
  );
}
