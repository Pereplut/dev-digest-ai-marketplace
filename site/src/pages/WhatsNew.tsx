import { href } from '../lib/router';
import { Markdown, useCatalog } from '../components/ui';

export function WhatsNew() {
  const { catalog } = useCatalog();
  const { releases, index } = catalog;
  return (
    <>
      <h1>What's new</h1>
      <p className="lede">
        Every release from each plugin's CHANGELOG, newest first. Subscribe with the <a href="./feed.xml">Atom feed</a>.
      </p>
      <ol className="releases" data-testid="releases">
        {releases.map((r) => (
          <li key={r.tag} className="release">
            <header>
              <a href={href('plugin', r.plugin)} className="release-plugin">{r.plugin}</a>
              <span className="version">v{r.version}</span>
              {r.date && <time dateTime={r.date}>{r.date}</time>}
              {r.tagged
                ? <a className="pill" href={`https://github.com/${index.marketplace.repo}/releases/tag/${encodeURIComponent(r.tag)}`} target="_blank" rel="noopener noreferrer">{r.tag}</a>
                : <span className="pill pill-muted" title="No git tag yet: this version is on main but not released">untagged</span>}
            </header>
            <Markdown md={r.notes} />
          </li>
        ))}
      </ol>
    </>
  );
}
