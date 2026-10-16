// Shared helpers for repo tooling: reading the marketplace, plugin manifests and component frontmatter.
// Node >= 22, no dependencies.
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

export function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Recursively list files under dir, skipping VCS and dependency dirs. */
export function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.git' || name === 'node_modules' || name === '__pycache__' || name === 'results') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

/**
 * Minimal YAML-frontmatter reader for agent and skill files. It handles the subset these files use:
 * `key: value`, quoted values, folded/literal blocks (`>-`, `|`), inline lists `[a, b]` and
 * `- item` lists. Anything more complex is kept as a raw string.
 */
export function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text, hasFrontmatter: false };
  const lines = m[1].split(/\r?\n/);
  const data = {};
  for (let i = 0; i < lines.length; i++) {
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(lines[i]);
    if (!kv) continue;
    const [, key, rawValue] = kv;
    let value = rawValue.trim();
    if (value === '>-' || value === '>' || value === '|' || value === '|-') {
      const block = [];
      while (i + 1 < lines.length && (/^\s+/.test(lines[i + 1]) || lines[i + 1] === '')) block.push(lines[++i].trim());
      value = value.startsWith('>') ? block.join(' ').replace(/\s+/g, ' ').trim() : block.join('\n');
    } else if (value === '') {
      const items = [];
      const nested = {};
      while (i + 1 < lines.length && /^\s+/.test(lines[i + 1])) {
        const line = lines[++i];
        const item = /^\s+-\s+(.*)$/.exec(line);
        const sub = /^\s+([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
        if (item) items.push(unquote(item[1].trim()));
        else if (sub) nested[sub[1]] = unquote(sub[2].trim());
      }
      value = items.length ? items : Object.keys(nested).length ? nested : '';
    } else if (value.startsWith('[') && value.endsWith(']')) {
      value = value.slice(1, -1).split(',').map((s) => unquote(s.trim())).filter(Boolean);
    } else {
      value = unquote(value);
    }
    data[key] = value;
  }
  return { data, body: text.slice(m[0].length), hasFrontmatter: true };
}

function unquote(s) {
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) return s.slice(1, -1);
  if (s === 'true') return true;
  if (s === 'false') return false;
  return s;
}

/** Comma- or list-valued frontmatter field as an array of trimmed names. */
export function asList(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === 'string' && v.trim()) return v.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/** Load the marketplace plus every plugin it lists, with components. */
export function loadMarketplace(root) {
  const marketplacePath = join(root, '.claude-plugin', 'marketplace.json');
  const marketplace = readJson(marketplacePath);
  const plugins = marketplace.plugins.map((entry) => {
    const dir = join(root, entry.source);
    const manifestPath = join(dir, '.claude-plugin', 'plugin.json');
    const manifest = existsSync(manifestPath) ? readJson(manifestPath) : null;
    return { entry, dir, rel: relative(root, dir), manifestPath, manifest, components: loadComponents(dir) };
  });
  return { marketplace, plugins };
}

export function loadComponents(dir) {
  const components = [];
  const agentsDir = join(dir, 'agents');
  if (existsSync(agentsDir)) {
    for (const f of readdirSync(agentsDir).filter((n) => n.endsWith('.md')).sort()) {
      const path = join(agentsDir, f);
      const text = readFileSync(path, 'utf8');
      components.push({ type: 'agent', name: f.replace(/\.md$/, ''), path, text, ...parseFrontmatter(text) });
    }
  }
  const skillsDir = join(dir, 'skills');
  if (existsSync(skillsDir)) {
    for (const d of readdirSync(skillsDir).sort()) {
      const path = join(skillsDir, d, 'SKILL.md');
      if (!existsSync(path)) continue;
      const text = readFileSync(path, 'utf8');
      components.push({ type: 'skill', name: d, path, text, ...parseFrontmatter(text) });
    }
  }
  return components;
}

/** Tiny SemVer helpers: enough for ^ ~ >= = and exact ranges on x.y.z. */
export function parseVersion(v) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(v).trim());
  return m ? m.slice(1).map(Number) : null;
}

export function cmp(a, b) {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i];
  return 0;
}

export function satisfies(version, range) {
  const v = parseVersion(version);
  if (!v) return false;
  const r = String(range).trim();
  const op = /^(\^|~|>=|=)?\s*(.+)$/.exec(r);
  const base = parseVersion(op[2]);
  if (!base) return false;
  switch (op[1]) {
    case '^':
      if (cmp(v, base) < 0) return false;
      if (base[0] > 0) return v[0] === base[0];
      if (base[1] > 0) return v[0] === 0 && v[1] === base[1];
      return cmp(v, base) === 0;
    case '~':
      return cmp(v, base) >= 0 && v[0] === base[0] && v[1] === base[1];
    case '>=':
      return cmp(v, base) >= 0;
    default:
      return cmp(v, base) === 0;
  }
}
