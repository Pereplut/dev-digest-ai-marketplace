#!/usr/bin/env node
// Check that the stable channel is installable on its own (docs/RELEASES.md#channels). The channel
// resolves dependencies inside itself, so every dependency of every pinned plugin must be pinned
// there too, at a version inside the range. Ranges come from plugin.json at the pinned commit, which
// is what users install, not from main. `claude plugin validate` does not check this. Without the
// check, a rollback onto a channel missing its dependencies passes validation and then installs as
// dependency-unsatisfied.
//
//   node scripts/check-stable-deps.mjs [--root <dir>]
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { readJson, satisfies } from './lib/repo.mjs';

const versionOf = (entry) => /--v(.+)$/.exec(entry.source?.ref ?? '')?.[1] ?? null;

/** readManifest(sha, path) returns plugin.json of `path` at commit `sha`. */
export function checkStable(stable, readManifest) {
  const problems = [];
  const pinned = new Map(stable.plugins.map((p) => [p.name, p]));
  for (const p of stable.plugins) {
    const v = versionOf(p);
    if (!v || !p.source?.sha) { problems.push(`${p.name}: not pinned to a <plugin>--v<version> ref and a sha`); continue; }
    let manifest;
    try { manifest = readManifest(p.source.sha, p.source.path); } catch (e) { problems.push(`${p.name}: cannot read plugin.json at ${p.source.sha.slice(0, 12)}: ${e.message}`); continue; }
    for (const d of manifest.dependencies ?? []) {
      const name = typeof d === 'string' ? d : d.name;
      const range = typeof d === 'string' ? '*' : d.version ?? '*';
      const dep = pinned.get(name);
      if (!dep) { problems.push(`${p.name} ${v} needs ${name} ${range}, which the stable channel does not pin`); continue; }
      const dv = versionOf(dep);
      if (range !== '*' && !satisfies(dv, range)) problems.push(`${p.name} ${v} needs ${name} ${range}; stable pins ${dv}`);
    }
  }
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const root = resolve(i > 0 ? process.argv[i + 1] : process.cwd());
  const stable = readJson(join(root, 'channels', 'stable', '.claude-plugin', 'marketplace.json'));
  const problems = checkStable(stable, (sha, path) =>
    JSON.parse(execFileSync('git', ['show', `${sha}:${path}/.claude-plugin/plugin.json`], { cwd: root, encoding: 'utf8' })));
  for (const p of problems) console.error(`  ✗ ${p}`);
  console.log(problems.length ? `stable channel: ${problems.length} problem(s)` : `stable channel: ok (${stable.plugins.length} plugins, dependencies pinned in range)`);
  process.exit(problems.length ? 1 : 0);
}
