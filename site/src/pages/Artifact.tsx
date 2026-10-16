import { href } from '../lib/router';
import { useBody } from '../lib/data';
import { Badge, Command, Markdown, formatTokens, useCatalog } from '../components/ui';
import { NotFound } from './NotFound';

export function ArtifactPage({ id }: { id: string }) {
  const { catalog } = useCatalog();
  const { index, stats } = catalog;
  const a = index.artifacts.find((x) => x.id === id);
  const body = useBody(a?.bodyPath);
  if (!a) return <NotFound what={`artifact “${id}”`} />;
  const s = stats.artifacts[a.id];
  const plugin = index.plugins.find((p) => p.name === a.plugin)!;
  const dir = a.path.replace(/\/[^/]+$/, '/');
  const linkBase = `https://github.com/${index.marketplace.repo}/blob/main/${dir}`;
  const known = new Set(index.artifacts.map((x) => x.id));

  return (
    <div className="detail">
      <nav className="crumbs"><a href="#/">Catalog</a> / <a href={href('plugin', a.plugin)}>{a.plugin}</a> / {a.name}</nav>
      <header className="detail-head">
        <h1>{a.name}</h1>
        <Badge kind={a.type}>{a.type}</Badge>
        {a.manual && <span className="pill">manual only</span>}
      </header>
      <p className="lede">{a.description}</p>

      <div className="detail-grid">
        <section className="panel">
          <h2>Use it</h2>
          <Command text={a.argumentHint ? `${a.invocation} ${a.argumentHint}` : a.invocation} testId="copy-invocation" />
          <p className="muted small">
            {a.type === 'agent'
              ? 'Mention the agent, or let Claude delegate to it from its description.'
              : a.manual ? 'Manual only: Claude never runs it on its own.' : 'Claude loads it when a task matches its description; you can also run it directly.'}
            {' '}Requires <a href={href('plugin', a.plugin)}>{a.plugin}</a> v{plugin.version}.
          </p>
        </section>

        <section className="panel">
          <h2>Details</h2>
          <dl className="facts">
            {a.type === 'agent' && <><dt>Tools</dt><dd>{a.tools.length ? a.tools.join(', ') : 'inherits all'}</dd></>}
            {a.disallowedTools.length > 0 && <><dt>Denied</dt><dd>{a.disallowedTools.join(', ')}</dd></>}
            {a.type === 'agent' && <><dt>Model</dt><dd>{a.model ?? 'inherit'}</dd></>}
            {a.skills.length > 0 && <><dt>Skills</dt><dd>{a.skills.map((k, i) => <span key={k}>{i > 0 && ', '}{known.has(k) ? <a href={href('artifact', k)}>{k}</a> : k}</span>)}</dd></>}
            <dt>Source</dt><dd><a href={`https://github.com/${index.marketplace.repo}/blob/main/${a.path}`} target="_blank" rel="noopener noreferrer">{a.path}</a></dd>
          </dl>
        </section>

        <section className="panel" data-testid="artifact-tokens">
          <h2>Context cost</h2>
          <dl className="facts">
            <dt>Description</dt><dd>~{formatTokens(s.discoveryTokens)} tokens, {a.manual ? 'not listed (manual only)' : 'in every session'}</dd>
            <dt>Body</dt><dd>~{formatTokens(s.tokens)} tokens when it loads</dd>
            {s.supportingBytes > 0 && <><dt>References</dt><dd>~{formatTokens(s.supportingTokens)} tokens across {a.supporting.length} file{a.supporting.length > 1 ? 's' : ''}, read only on demand</dd></>}
          </dl>
          <p className="muted small">Estimates: {stats.method}.</p>
        </section>

        <section className="panel">
          <h2>Used by</h2>
          {a.usedBy.length === 0 ? <p className="muted">No other component references it.</p> : (
            <ul className="plain-list" data-testid="used-by">
              {a.usedBy.map((u) => <li key={u}><a href={href('artifact', u)}>{u}</a></li>)}
            </ul>
          )}
        </section>
      </div>

      <section>
        <h2 className="section-title">{a.type === 'skill' ? 'SKILL.md' : 'Agent prompt'}</h2>
        {body.error ? <p className="warn">Could not load the body: {body.error}</p>
          : body.text == null ? <p className="muted">Loading…</p>
          : <Markdown md={body.text} linkBase={linkBase} />}
      </section>
    </div>
  );
}
