// Search adapter over MiniSearch (SITE-SPEC AC-1, AC-2, AC-3). Pure: takes the catalog, returns hits.
import MiniSearch from 'minisearch';
import type { Artifact, Catalog, PluginRow } from '../types';

export type HitKind = 'plugin' | 'skill' | 'agent';

export interface Hit {
  id: string;
  kind: HitKind;
  name: string;
  plugin: string;
  description: string;
  tags: string[];
  score: number;
  terms: string[];
}

interface Doc {
  id: string;
  kind: HitKind;
  name: string;
  plugin: string;
  description: string;
  keywords: string;
  tags: string[];
  body: string;
}

export function documents(catalog: Catalog): Doc[] {
  const text = new Map(catalog.search.map((r) => [r.id, r.text]));
  const tagsOf = new Map(catalog.index.plugins.map((p) => [p.name, p.tags]));
  const plugins = catalog.index.plugins.map((p: PluginRow): Doc => ({
    id: p.name,
    kind: 'plugin',
    name: p.name,
    plugin: p.name,
    description: p.summary,
    keywords: [...p.keywords, ...p.tags].join(' '),
    tags: p.tags,
    body: text.get(p.name) ?? '',
  }));
  const artifacts = catalog.index.artifacts.map((a: Artifact): Doc => ({
    id: a.id,
    kind: a.type,
    name: a.name,
    plugin: a.plugin,
    description: a.description,
    keywords: a.keywords.join(' '),
    tags: tagsOf.get(a.plugin) ?? [],
    body: text.get(a.id) ?? '',
  }));
  return [...plugins, ...artifacts];
}

export function createSearch(catalog: Catalog) {
  const ms = new MiniSearch<Doc>({
    fields: ['name', 'description', 'keywords', 'body'],
    storeFields: ['kind', 'name', 'plugin', 'description', 'tags'],
    // Hyphenated names should match on their parts: "onion" finds onion-architecture.
    tokenize: (s) => s.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
    searchOptions: {
      boost: { name: 4, description: 3, keywords: 2, body: 1 },
      prefix: true,
      fuzzy: (term) => (term.length > 4 ? 0.2 : false),
      combineWith: 'AND',
    },
  });
  ms.addAll(documents(catalog));
  return (query: string, filter: { kind?: HitKind | ''; tag?: string } = {}): Hit[] => {
    const q = query.trim();
    if (!q) return [];
    return ms
      .search(q, {
        filter: (r) => (!filter.kind || r.kind === filter.kind) && (!filter.tag || (r.tags as string[]).includes(filter.tag)),
      })
      .map((r) => ({
        id: r.id as string,
        kind: r.kind as HitKind,
        name: r.name as string,
        plugin: r.plugin as string,
        description: r.description as string,
        tags: r.tags as string[],
        score: r.score,
        terms: r.terms,
      }));
  };
}

/** Split text into plain and matched segments for highlighting without HTML. */
export function highlight(text: string, terms: string[]): { text: string; match: boolean }[] {
  const t = terms.filter((x) => x.length > 1).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  if (!t.length) return [{ text, match: false }];
  // split() with one capture group alternates plain, match, plain, ...: odd indices are matches.
  return text
    .split(new RegExp(`(${t.join('|')})`, 'gi'))
    .map((part, i) => ({ text: part, match: i % 2 === 1 }))
    .filter((s) => s.text);
}
