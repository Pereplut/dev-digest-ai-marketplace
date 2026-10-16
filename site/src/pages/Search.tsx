import { useEffect, useMemo, useRef, useState } from 'react';
import type { Route } from '../lib/router';
import { href } from '../lib/router';
import { createSearch, type HitKind } from '../lib/search';
import { ArtifactCard, Badge, Highlighted, useCatalog } from '../components/ui';

/** Search box that writes the query into the URL, so every search is a shareable link. */
export function SearchBox({ initial = '', autoFocus = false }: { initial?: string; autoFocus?: boolean }) {
  const [q, setQ] = useState(initial);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => setQ(initial), [initial]);
  useEffect(() => {
    // Arriving from the home page mid-word: keep typing where the caret was.
    const el = ref.current;
    if (autoFocus && el) el.setSelectionRange(el.value.length, el.value.length);
  }, [autoFocus]);
  useEffect(() => {
    // "/" focuses search from anywhere, like most docs sites.
    const on = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        ref.current?.focus();
      }
    };
    addEventListener('keydown', on);
    return () => removeEventListener('keydown', on);
  }, []);
  return (
    <form
      role="search"
      className="search-box"
      onSubmit={(e) => {
        e.preventDefault();
        location.hash = href('search', undefined, { q });
      }}
    >
      <input
        ref={ref}
        type="search"
        aria-label="Search plugins, skills and agents"
        placeholder="Search plugins, skills and agents (press /)"
        value={q}
        autoFocus={autoFocus}
        onChange={(e) => {
          setQ(e.target.value);
          const current = new URLSearchParams(location.hash.split('?')[1] ?? '');
          location.replace(href('search', undefined, { q: e.target.value, type: current.get('type') ?? '', tag: current.get('tag') ?? '' }));
        }}
      />
    </form>
  );
}

const KINDS: { value: HitKind | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'plugin', label: 'Plugins' },
  { value: 'skill', label: 'Skills' },
  { value: 'agent', label: 'Agents' },
];

export function Search({ route }: { route: Route }) {
  const { catalog } = useCatalog();
  const search = useMemo(() => createSearch(catalog), [catalog]);
  const q = route.query.get('q') ?? '';
  const kind = (route.query.get('type') ?? '') as HitKind | '';
  const tag = route.query.get('tag') ?? '';
  const hits = useMemo(() => search(q, { kind, tag }), [search, q, kind, tag]);
  const artifacts = new Map(catalog.index.artifacts.map((a) => [a.id, a]));
  const plugins = new Map(catalog.index.plugins.map((p) => [p.name, p]));
  const link = (over: Record<string, string>) => href('search', undefined, { q, type: kind, tag, ...over });

  return (
    <>
      <SearchBox initial={q} autoFocus />
      <div className="filters" aria-label="Filters">
        <div className="chips" role="group" aria-label="Type">
          {KINDS.map((k) => (
            <a key={k.label} className={`chip ${kind === k.value ? 'on' : ''}`} href={link({ type: k.value })} aria-current={kind === k.value}>{k.label}</a>
          ))}
        </div>
        <div className="chips" role="group" aria-label="Tag">
          {catalog.index.tags.map((t) => (
            <a key={t} className={`chip chip-tag ${tag === t ? 'on' : ''}`} href={link({ tag: tag === t ? '' : t })} aria-current={tag === t}>#{t}</a>
          ))}
        </div>
      </div>

      {!q.trim() ? (
        <p className="muted">Type to search names, descriptions, keywords, READMEs and full skill and agent text.</p>
      ) : hits.length === 0 ? (
        <div className="empty" data-testid="search-empty">
          <h2>Nothing matches “{q}”</h2>
          <p>Try a shorter word, clear the filters, or <a href="#/">browse all plugins</a>.</p>
        </div>
      ) : (
        <>
          <p className="muted" data-testid="search-count">{hits.length} result{hits.length > 1 ? 's' : ''}</p>
          <div className="grid">
            {hits.map((h) => {
              const a = artifacts.get(h.id);
              if (a) return <ArtifactCard key={h.id} artifact={a} terms={h.terms} />;
              const p = plugins.get(h.id)!;
              return (
                <article key={h.id} className="card" data-testid={`plugin-card-${p.name}`}>
                  <header className="card-head">
                    <Badge kind="plugin">plugin</Badge>
                    <a className="card-title" href={href('plugin', p.name)}><Highlighted text={p.name} terms={h.terms} /></a>
                    <span className="version">v{p.version}</span>
                  </header>
                  <p className="card-desc clamp"><Highlighted text={p.summary} terms={h.terms} /></p>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
