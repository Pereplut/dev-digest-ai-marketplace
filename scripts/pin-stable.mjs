#!/usr/bin/env node
// Pin one plugin entry of the stable channel to a release tag and its commit SHA.
// Used by scripts/promote.sh and scripts/rollback.sh; never edit channels/stable/ by hand.
//
//   node scripts/pin-stable.mjs <plugin> <version> <sha> [--root <dir>] [--repo-url <url>]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { readJson } from './lib/repo.mjs';

export const STABLE_NAME = 'dev-digest-ai-marketplace-stable';
export const DEFAULT_REPO_URL = 'https://github.com/Pereplut/dev-digest-ai-marketplace.git';

export function pin({ root, plugin, version, sha, repoUrl = DEFAULT_REPO_URL }) {
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new Error(`sha must be a full 40-character lowercase commit SHA, got "${sha}"`);
  const latest = readJson(join(root, '.claude-plugin', 'marketplace.json'));
  const latestEntry = latest.plugins.find((p) => p.name === plugin);
  if (!latestEntry) throw new Error(`plugin "${plugin}" is not in .claude-plugin/marketplace.json`);

  const stablePath = join(root, 'channels', 'stable', '.claude-plugin', 'marketplace.json');
  const stable = existsSync(stablePath)
    ? readJson(stablePath)
    : { name: STABLE_NAME, owner: latest.owner, description: `${latest.description} (stable channel: pinned release tags)`, plugins: [] };

  const { source, ...meta } = latestEntry;
  const entry = {
    ...meta,
    source: { source: 'git-subdir', url: repoUrl, path: source.replace(/^\.\//, ''), ref: `${plugin}--v${version}`, sha },
  };
  const i = stable.plugins.findIndex((p) => p.name === plugin);
  if (i >= 0) stable.plugins[i] = entry;
  else stable.plugins.push(entry);
  // Keep the channel in the same order as latest.
  const order = latest.plugins.map((p) => p.name);
  stable.plugins.sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));

  mkdirSync(dirname(stablePath), { recursive: true });
  writeFileSync(stablePath, JSON.stringify(stable, null, 2) + '\n');
  return { stablePath, entry };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); if (i < 0) return d; const v = args[i + 1]; args.splice(i, 2); return v; };
  const root = opt('--root', process.cwd());
  const repoUrl = opt('--repo-url', DEFAULT_REPO_URL);
  const [plugin, version, sha] = args;
  if (!plugin || !version || !sha) { console.error('usage: pin-stable.mjs <plugin> <version> <sha> [--root dir] [--repo-url url]'); process.exit(2); }
  try {
    const { stablePath, entry } = pin({ root, plugin, version, sha, repoUrl });
    console.log(`pinned ${plugin} -> ${entry.source.ref} (${sha.slice(0, 12)}) in ${stablePath}`);
  } catch (e) {
    console.error(`pin-stable: ${e.message}`);
    process.exit(1);
  }
}
