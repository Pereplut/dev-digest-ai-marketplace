import { href } from '../lib/router';
import { addMarketplaceCommand } from '../lib/commands';
import { Command, PluginCard, formatTokens, useCatalog } from '../components/ui';
import { SearchBox } from './Search';

export function Home() {
  const { catalog, channel } = useCatalog();
  const { index, releases, stats } = catalog;
  const totals = Object.values(stats.plugins).reduce(
    (t, s) => ({ skills: t.skills + s.skills, agents: t.agents + s.agents, discovery: t.discovery + s.discoveryTokens }),
    { skills: 0, agents: 0, discovery: 0 },
  );
  return (
    <>
      <section className="hero">
        <h1>Spec-Driven Development plugins for Claude Code</h1>
        <p className="lede">{index.marketplace.description}</p>
        <SearchBox autoFocus />
        <p className="hero-stats">
          {index.plugins.length} plugins · {totals.skills} skills · {totals.agents} agents · all of them add
          ~{formatTokens(totals.discovery)} tokens of descriptions to a session
        </p>
        <Command text={addMarketplaceCommand(index, channel)} testId="copy-add-marketplace" />
      </section>

      <section>
        <h2 className="section-title">Plugins</h2>
        <div className="grid">
          {index.plugins.map((p) => <PluginCard key={p.name} plugin={p} />)}
        </div>
      </section>

      <section className="split">
        <div>
          <h2 className="section-title">What's new</h2>
          <ul className="plain-list">
            {releases.slice(0, 4).map((r) => (
              <li key={r.tag}>
                <a href={href('plugin', r.plugin)}>{r.plugin}</a> <span className="version">v{r.version}</span>
                {r.date && <time className="muted"> {r.date}</time>}
              </li>
            ))}
          </ul>
          <a href={href('whats-new')}>All releases →</a>
        </div>
        <div>
          <h2 className="section-title">Start here</h2>
          <ul className="plain-list">
            <li><a href={href('getting-started')}>Install, update and roll back</a></li>
            <li><a href={href('team-setup')}>Enable plugins for a whole team</a></li>
            <li><a href={href('graph')}>See how the plugins depend on each other</a></li>
            <li><a href={href('compatibility')}>Check Claude Code version requirements</a></li>
          </ul>
        </div>
      </section>
    </>
  );
}
