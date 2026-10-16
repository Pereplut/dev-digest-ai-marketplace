import { useEffect, useMemo, useState } from 'react';
import type { Catalog, Channel } from './types';
import { loadCatalog, readChannel, saveChannel } from './lib/data';
import { href, useRoute, type Route } from './lib/router';
import { CatalogContext, useCatalog } from './components/ui';
import { Home } from './pages/Home';
import { Search } from './pages/Search';
import { PluginPage } from './pages/Plugin';
import { ArtifactPage } from './pages/Artifact';
import { GraphPage } from './pages/Graph';
import { WhatsNew } from './pages/WhatsNew';
import { GettingStarted } from './pages/GettingStarted';
import { TeamSetup } from './pages/TeamSetup';
import { Compatibility } from './pages/Compatibility';
import { NotFound } from './pages/NotFound';

const NAV: [string, string][] = [
  ['search', 'Search'],
  ['graph', 'Graph'],
  ['whats-new', "What's new"],
  ['getting-started', 'Getting started'],
  ['team-setup', 'Team setup'],
  ['compatibility', 'Compatibility'],
];

function Page({ route }: { route: Route }) {
  switch (route.name) {
    case '': return <Home />;
    case 'search': return <Search route={route} />;
    case 'plugin': return <PluginPage name={route.param} />;
    case 'artifact': return <ArtifactPage id={route.param} />;
    case 'graph': return <GraphPage />;
    case 'whats-new': return <WhatsNew />;
    case 'getting-started': return <GettingStarted />;
    case 'team-setup': return <TeamSetup />;
    case 'compatibility': return <Compatibility />;
    default: return <NotFound />;
  }
}

function ChannelToggle() {
  const { catalog, channel, setChannel } = useCatalog();
  const pinned = catalog.index.plugins.filter((p) => p.stable).length;
  return (
    <div className="channel" role="radiogroup" aria-label="Release channel">
      {(['latest', 'stable'] as Channel[]).map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={channel === c}
          className={channel === c ? 'on' : ''}
          data-testid={`channel-${c}`}
          title={c === 'stable' ? `Pinned release tags (${pinned} of ${catalog.index.plugins.length} plugins pinned)` : 'Follows main'}
          onClick={() => setChannel(c)}
        >
          {c}
        </button>
      ))}
    </div>
  );
}

function Shell({ route }: { route: Route }) {
  const { catalog } = useCatalog();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route.name, route.param]);
  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <a className="brand" href="#/">{catalog.index.marketplace.name}</a>
          <button type="button" className="menu-btn" aria-expanded={open} aria-controls="nav" onClick={() => setOpen((o) => !o)}>Menu</button>
          <nav id="nav" className={open ? 'open' : ''}>
            {NAV.map(([name, label]) => (
              <a key={name} href={href(name)} aria-current={route.name === name ? 'page' : undefined}>{label}</a>
            ))}
          </nav>
          <ChannelToggle />
        </div>
      </header>
      <main className="container">
        <Page route={route} />
      </main>
      <footer className="footer container">
        <a href={`https://github.com/${catalog.index.marketplace.repo}`} target="_blank" rel="noopener noreferrer">GitHub</a>
        <a href="./feed.xml">Atom feed</a>
        <a href={`https://github.com/${catalog.index.marketplace.repo}/blob/main/CONTRIBUTING.md`} target="_blank" rel="noopener noreferrer">Contribute a plugin</a>
        <a href={catalog.index.marketplace.reportUrl} target="_blank" rel="noopener noreferrer">Build report</a>
        <span className="muted">Built {catalog.index.generatedAt.slice(0, 10)}</span>
      </footer>
    </>
  );
}

export function App() {
  const route = useRoute();
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannelState] = useState<Channel>(readChannel);
  useEffect(() => { loadCatalog().then(setCatalog, (e: Error) => setError(e.message)); }, []);
  const ctx = useMemo(
    () => catalog && { catalog, channel, setChannel: (c: Channel) => { saveChannel(c); setChannelState(c); } },
    [catalog, channel],
  );
  if (error) return <main className="container"><div className="empty"><h1>Catalog failed to load</h1><p>{error}</p></div></main>;
  if (!ctx) return <main className="container"><p className="muted">Loading catalog…</p></main>;
  return (
    <CatalogContext.Provider value={ctx}>
      <Shell route={route} />
    </CatalogContext.Provider>
  );
}
