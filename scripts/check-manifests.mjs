#!/usr/bin/env node
// Marketplace consistency checks that `claude plugin validate` does not do (spec 0001 AC-1..AC-4, AC-12, AC-13, AC-18).
//
//   node scripts/check-manifests.mjs [--root <dir>]
//
// - marketplace entry name == plugin.json name; no version in entries; required files present
// - dependencies exist in this marketplace, use object form, are satisfied by the current versions, and have no cycles
// - every namespaced reference `<plugin>:<component>` in a component body points to an existing component of
//   this plugin or of a declared (transitive) dependency
// - agent frontmatter: no hooks / mcpServers / permissionMode; read-only agents disallow Write and Edit
// - skills: frontmatter name == directory; manual-only skills set disable-model-invocation: true
import { existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { loadMarketplace, asList, satisfies } from './lib/repo.mjs';

const REQUIRED_FILES = ['README.md', 'CHANGELOG.md', 'COMPATIBILITY.md'];
const FORBIDDEN_AGENT_FIELDS = ['hooks', 'mcpServers', 'permissionMode'];
const READ_ONLY_AGENTS = ['researcher', 'architecture-reviewer', 'implementation-planner', 'plan-verifier'];
const MANUAL_ONLY_SKILLS = ['run-plan', 'workflow-retro'];

export function check(root) {
  root = resolve(root);
  const errors = [];
  const err = (where, msg) => errors.push(`${where}: ${msg}`);
  const { marketplace, plugins } = loadMarketplace(root);
  const byName = new Map();

  for (const p of plugins) {
    const where = p.entry.name;
    if (!p.manifest) { err(where, `missing ${relative(root, p.manifestPath)}`); continue; }
    if (p.manifest.name !== p.entry.name) err(where, `marketplace entry name "${p.entry.name}" != plugin.json name "${p.manifest.name}"`);
    if ('version' in p.entry) err(where, 'marketplace entry sets "version"; keep it only in plugin.json');
    if (!p.manifest.version) err(where, 'plugin.json has no version');
    for (const f of REQUIRED_FILES) if (!existsSync(join(p.dir, f))) err(where, `missing ${f}`);
    byName.set(p.manifest.name, p);
  }

  // Dependencies.
  const deps = new Map();
  for (const p of plugins) {
    if (!p.manifest) continue;
    const list = [];
    for (const d of p.manifest.dependencies ?? []) {
      if (typeof d === 'string') { err(p.entry.name, `dependency "${d}" uses string form; use { "name", "version" } so the range is kept`); continue; }
      const target = byName.get(d.name);
      if (!target) { err(p.entry.name, `dependency "${d.name}" is not in this marketplace`); continue; }
      if (!d.version) err(p.entry.name, `dependency "${d.name}" has no version range`);
      else if (target.manifest && !satisfies(target.manifest.version, d.version))
        err(p.entry.name, `dependency "${d.name}" ${d.version} is not satisfied by current ${target.manifest.version}`);
      list.push(d.name);
    }
    deps.set(p.entry.name, list);
  }
  const closure = (name, seen = new Set(), stack = []) => {
    if (stack.includes(name)) { err(name, `dependency cycle: ${[...stack, name].join(' -> ')}`); return seen; }
    for (const d of deps.get(name) ?? []) if (!seen.has(d)) { seen.add(d); closure(d, seen, [...stack, name]); }
    return seen;
  };

  // Components.
  const componentIndex = new Map(); // "plugin:name" -> component
  for (const p of plugins) for (const c of p.components) componentIndex.set(`${p.entry.name}:${c.name}`, c);
  const pluginNames = plugins.map((p) => p.entry.name);
  const refRe = new RegExp(`\\b(${pluginNames.map((n) => n.replace(/-/g, '\\-')).join('|')}):([a-z0-9][a-z0-9-]*)`, 'g');

  for (const p of plugins) {
    const reachable = new Set([p.entry.name, ...closure(p.entry.name)]);
    for (const c of p.components) {
      const where = relative(root, c.path);
      if (!c.hasFrontmatter) { err(where, 'no frontmatter'); continue; }
      if (!c.data.description) err(where, 'frontmatter has no description');
      if (c.type === 'agent') {
        if (c.data.name && c.data.name !== c.name) err(where, `frontmatter name "${c.data.name}" != file name "${c.name}"`);
        for (const f of FORBIDDEN_AGENT_FIELDS) if (f in c.data) err(where, `plugin agents may not set "${f}" (ignored by Claude Code)`);
        if (READ_ONLY_AGENTS.includes(c.name)) {
          const disallowed = asList(c.data.disallowedTools);
          const tools = asList(c.data.tools);
          for (const t of ['Write', 'Edit']) if (!disallowed.includes(t) || tools.includes(t)) err(where, `read-only agent must disallow ${t}`);
        }
      } else {
        if (c.data.name && c.data.name !== c.name) err(where, `frontmatter name "${c.data.name}" != directory "${c.name}"`);
        if (MANUAL_ONLY_SKILLS.includes(c.name) && c.data['disable-model-invocation'] !== true)
          err(where, 'manual-only skill must set disable-model-invocation: true');
      }
      const refs = new Set([...c.text.matchAll(refRe)].map((m) => `${m[1]}:${m[2]}`));
      for (const s of asList(c.data.skills)) if (s.includes(':')) refs.add(s);
      for (const ref of refs) {
        const [plugin] = ref.split(':');
        if (!componentIndex.has(ref)) err(where, `reference "${ref}" does not match any component`);
        else if (!reachable.has(plugin)) err(where, `references "${ref}" but ${p.entry.name} does not depend on ${plugin}`);
      }
    }
  }
  return { errors, marketplace, plugins };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const { errors, plugins } = check(i > 0 ? process.argv[i + 1] : process.cwd());
  for (const e of errors) console.log(`  ✗ ${e}`);
  console.log(errors.length ? `\nmanifests: ${errors.length} problem(s)` : `manifests: ok (${plugins.length} plugins)`);
  process.exit(errors.length ? 1 : 0);
}
