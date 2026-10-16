// Small hand-built catalog for unit tests: base <- mid <- app, plus an unrelated plugin.
import type { Artifact, Catalog, PluginRow } from '../types';

const plugin = (name: string, deps: string[] = [], over: Partial<PluginRow> = {}): PluginRow => ({
  name,
  version: '1.0.0',
  description: `${name} description`,
  summary: `${name} summary`,
  category: null,
  tags: [],
  keywords: [],
  author: { name: 'x' },
  license: 'MIT',
  homepage: null,
  repository: null,
  dependencies: deps.map((d) => ({ name: d, version: '^1.0.0' })),
  dependents: [],
  components: [],
  minClaudeCode: '2.1.110',
  testedOn: null,
  stable: null,
  path: `plugins/${name}`,
  readmePath: `bodies/${name}.md`,
  ...over,
});

const artifact = (plugin: string, name: string, type: Artifact['type'], description: string): Artifact => ({
  id: `${plugin}:${name}`,
  type,
  plugin,
  name,
  description,
  keywords: [],
  version: '1.0.0',
  tools: [],
  disallowedTools: [],
  model: null,
  skills: [],
  manual: false,
  argumentHint: null,
  invocation: type === 'skill' ? `/${plugin}:${name}` : `@agent-${plugin}:${name}`,
  path: `plugins/${plugin}/x`,
  bodyPath: `bodies/${plugin}__${name}.md`,
  supporting: [],
  usedBy: [],
});

export function fixtureCatalog(): Catalog {
  return {
    index: {
      generatedAt: '2026-10-16T00:00:00Z',
      marketplace: { name: 'mkt', description: 'd', owner: { name: 'o' }, repo: 'owner/mkt', siteUrl: 'https://o.github.io/mkt/', reportUrl: 'https://claude.ai/artifact/example' },
      channels: { latest: 'mkt', stable: null },
      tags: ['architecture', 'review'],
      plugins: [
        plugin('base', [], { tags: ['architecture'], keywords: ['layering'] }),
        plugin('mid', ['base'], { tags: ['review'] }),
        plugin('app', ['mid']),
        plugin('lonely'),
      ],
      artifacts: [
        artifact('base', 'onion-architecture', 'skill', 'Four-ring dependency rule for backends.'),
        artifact('mid', 'reviewer', 'agent', 'Reviews a diff against layering rules.'),
        artifact('app', 'run-plan', 'skill', 'Executes a saved plan.'),
      ],
      compatibility: [],
    },
    search: [
      { id: 'app:run-plan', text: 'Dispatches the implementer and the verification gate.' },
      { id: 'base', text: 'Readme mentions hexagonal ports.' },
    ],
    releases: [],
    stats: { method: 'chars / 4', artifacts: {}, plugins: {} },
  };
}
