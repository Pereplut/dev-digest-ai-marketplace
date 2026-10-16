// Shapes written by scripts/build-index.mjs. Keep in sync with that file.

export interface Dependency {
  name: string;
  version: string;
}

export interface PluginRow {
  name: string;
  version: string;
  description: string;
  summary: string;
  category: string | null;
  tags: string[];
  keywords: string[];
  author: { name: string; url?: string } | null;
  license: string | null;
  homepage: string | null;
  repository: string | null;
  dependencies: Dependency[];
  dependents: string[];
  components: string[];
  minClaudeCode: string | null;
  testedOn: string | null;
  stable: { version: string; ref: string; sha: string | null } | null;
  path: string;
  readmePath: string;
}

export type ArtifactType = 'skill' | 'agent';

export interface Artifact {
  id: string;
  type: ArtifactType;
  plugin: string;
  name: string;
  description: string;
  keywords: string[];
  version: string;
  tools: string[];
  disallowedTools: string[];
  model: string | null;
  skills: string[];
  manual: boolean;
  argumentHint: string | null;
  invocation: string;
  path: string;
  bodyPath: string;
  supporting: string[];
  usedBy: string[];
}

export interface CompatRow {
  plugin: string;
  version: string;
  minClaudeCode: string | null;
  testedOn: string | null;
  source: string;
}

export interface Index {
  generatedAt: string;
  marketplace: { name: string; description: string; owner: { name: string; url?: string }; repo: string; siteUrl: string; reportUrl: string };
  channels: { latest: string; stable: string | null };
  tags: string[];
  plugins: PluginRow[];
  artifacts: Artifact[];
  compatibility: CompatRow[];
}

export interface SearchRow {
  id: string;
  text: string;
}

export interface Release {
  plugin: string;
  version: string;
  date: string | null;
  notes: string;
  tag: string;
  tagged: boolean;
}

export interface ArtifactStats {
  bytes: number;
  tokens: number;
  discoveryTokens: number;
  supportingBytes: number;
  supportingTokens: number;
}

export interface PluginStats {
  artifacts: number;
  skills: number;
  agents: number;
  bytes: number;
  tokens: number;
  discoveryTokens: number;
  readmeTokens: number;
}

export interface Stats {
  method: string;
  artifacts: Record<string, ArtifactStats>;
  plugins: Record<string, PluginStats>;
}

export interface Catalog {
  index: Index;
  search: SearchRow[];
  releases: Release[];
  stats: Stats;
}

export type Channel = 'latest' | 'stable';
