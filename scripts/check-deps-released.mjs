#!/usr/bin/env node
// Exit 0 when every dependency range of <plugin> is satisfied by an existing `<dep>--v<version>` git tag.
// Enforces the deps-first release order (docs/RELEASES.md).
//
//   node scripts/check-deps-released.mjs <plugin> [--root <dir>]
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readJson, satisfies, parseVersion, cmp } from './lib/repo.mjs';

export function releasedVersions(tags, plugin) {
  const prefix = `${plugin}--v`;
  return tags.filter((t) => t.startsWith(prefix)).map((t) => t.slice(prefix.length)).filter(parseVersion);
}

export function unmet(manifest, tags) {
  const problems = [];
  for (const d of manifest.dependencies ?? []) {
    const name = typeof d === 'string' ? d : d.name;
    const range = typeof d === 'string' ? '>=0.0.0' : d.version ?? '>=0.0.0';
    const versions = releasedVersions(tags, name);
    const best = versions.filter((v) => satisfies(v, range)).sort((a, b) => cmp(parseVersion(b), parseVersion(a)))[0];
    if (!best) problems.push(`${name} ${range}: no tag satisfies it (released: ${versions.join(', ') || 'none'})`);
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const i = args.indexOf('--root');
  const root = i >= 0 ? args[i + 1] : process.cwd();
  const plugin = args.find((a, j) => !a.startsWith('--') && args[j - 1] !== '--root');
  if (!plugin) { console.error('usage: check-deps-released.mjs <plugin> [--root dir]'); process.exit(2); }
  const manifest = readJson(join(root, 'plugins', plugin, '.claude-plugin', 'plugin.json'));
  const tags = execFileSync('git', ['-C', root, 'tag', '--list'], { encoding: 'utf8' }).split('\n').filter(Boolean);
  const problems = unmet(manifest, tags);
  for (const p of problems) console.log(`  ✗ ${p}`);
  console.log(problems.length ? `deps-released: ${problems.length} unmet` : `deps-released: ok (${(manifest.dependencies ?? []).length} dependencies)`);
  process.exit(problems.length ? 1 : 0);
}
