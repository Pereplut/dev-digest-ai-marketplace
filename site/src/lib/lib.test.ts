import { describe, expect, it } from 'vitest';
import { fixtureCatalog } from './fixture';
import { createSearch, highlight } from './search';
import { renderMarkdown } from './markdown';
import { installCommand, teamSettings, withDependencies } from './commands';
import { graphData } from './graph';
import { parseHash, href } from './router';

describe('search (SITE-SPEC AC-1, AC-2, AC-3)', () => {
  const search = createSearch(fixtureCatalog());

  it('matches a hyphenated skill by one part of its name and keeps its parent plugin', () => {
    const [top] = search('onion');
    expect(top).toMatchObject({ id: 'base:onion-architecture', kind: 'skill', plugin: 'base' });
  });

  it('matches body text and README text, not only names', () => {
    expect(search('implementer').map((h) => h.id)).toContain('app:run-plan');
    expect(search('hexagonal').map((h) => h.id)).toContain('base');
  });

  it('ranks a name match above a body-only match', () => {
    const ids = search('layering').map((h) => h.id);
    expect(ids.indexOf('base')).toBeGreaterThanOrEqual(0);
    expect(search('reviewer')[0].id).toBe('mid:reviewer');
  });

  it('filters by type and tag', () => {
    expect(search('layering', { kind: 'agent' }).every((h) => h.kind === 'agent')).toBe(true);
    expect(search('summary', { tag: 'review' }).map((h) => h.id)).toEqual(['mid']);
  });

  it('returns nothing for an empty or nonsense query', () => {
    expect(search('   ')).toEqual([]);
    expect(search('zzqxv')).toEqual([]);
  });

  it('highlights matched terms without producing HTML', () => {
    expect(highlight('Onion rings', ['onion'])).toEqual([{ text: 'Onion', match: true }, { text: ' rings', match: false }]);
    expect(highlight('a<bc>', ['bc'])).toEqual([{ text: 'a<', match: false }, { text: 'bc', match: true }, { text: '>', match: false }]);
    expect(highlight('a b', ['a'])).toEqual([{ text: 'a b', match: false }]); // one-letter terms are noise
  });
});

describe('markdown sanitizing (AC-6)', () => {
  it('strips scripts, event handlers and javascript: links', () => {
    const html = renderMarkdown('Hi <script>alert(1)</script><img src=x onerror="alert(2)"> [x](javascript:alert(3))');
    expect(html).not.toMatch(/<script|onerror|javascript:/i);
    expect(html).toContain('<img src="x">');
  });

  it('drops frontmatter and opens external links safely', () => {
    const html = renderMarkdown('---\nname: x\n---\n[docs](https://example.com)');
    expect(html).not.toContain('name: x');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('resolves relative links against the source on GitHub', () => {
    const html = renderMarkdown('[notes](docs/a.md)', 'https://github.com/o/r/blob/main/plugins/p/');
    expect(html).toContain('href="https://github.com/o/r/blob/main/plugins/p/docs/a.md"');
  });
});

describe('commands (AC-5, AC-7)', () => {
  const { index } = fixtureCatalog();

  it('names the marketplace per channel', () => {
    expect(installCommand(index, 'app', 'latest')).toBe('/plugin install app@mkt');
    expect(installCommand(index, 'app', 'stable')).toBe('/plugin install app@mkt-stable');
  });

  it('adds transitive dependencies in marketplace order', () => {
    expect(withDependencies(index, ['app'])).toEqual(['base', 'mid', 'app']);
    expect(withDependencies(index, ['lonely'])).toEqual(['lonely']);
  });

  it('builds a settings block with the marketplace and every resolved plugin', () => {
    const s = teamSettings(index, ['app'], 'latest');
    expect(JSON.parse(JSON.stringify(s))).toEqual({
      extraKnownMarketplaces: { mkt: { source: { source: 'github', repo: 'owner/mkt' } } },
      enabledPlugins: { 'base@mkt': true, 'mid@mkt': true, 'app@mkt': true },
    });
    const stable = teamSettings(index, ['mid'], 'stable');
    expect(stable.extraKnownMarketplaces['mkt-stable'].source).toEqual({
      source: 'url',
      url: 'https://raw.githubusercontent.com/owner/mkt/main/channels/stable/.claude-plugin/marketplace.json',
    });
    expect(Object.keys(stable.enabledPlugins)).toEqual(['base@mkt-stable', 'mid@mkt-stable']);
  });
});

describe('graph (AC-8)', () => {
  it('has one node per plugin and one edge per declared dependency, layered by depth', () => {
    const { nodes, edges } = graphData(fixtureCatalog().index);
    expect(nodes).toHaveLength(4);
    expect(edges.map(({ from, to, range }) => ({ from, to, range }))).toEqual([
      { from: 'mid', to: 'base', range: '^1.0.0' },
      { from: 'app', to: 'mid', range: '^1.0.0' },
    ]);
    const layer = Object.fromEntries(nodes.map((n) => [n.name, n.layer]));
    expect(layer).toEqual({ base: 0, lonely: 0, mid: 1, app: 2 });
  });

  it('routes an edge that skips a column around the nodes in between', () => {
    const index = fixtureCatalog().index;
    index.plugins[2].dependencies.push({ name: 'base', version: '^1.0.0' }); // app -> base skips mid
    const { edges } = graphData(index);
    expect(edges.find((e) => e.from === 'app' && e.to === 'base')!.path).toContain(' L');
    expect(edges.find((e) => e.from === 'app' && e.to === 'mid')!.path).not.toContain(' L');
  });
});

describe('router', () => {
  it('round-trips artifact ids and queries', () => {
    expect(href('artifact', 'base:onion-architecture')).toBe('#/artifact/base:onion-architecture');
    expect(parseHash('#/artifact/base:onion-architecture').param).toBe('base:onion-architecture');
    const r = parseHash(href('search', undefined, { q: 'a b', type: 'skill', tag: '' }));
    expect([r.name, r.query.get('q'), r.query.get('type'), r.query.has('tag')]).toEqual(['search', 'a b', 'skill', false]);
  });
});
