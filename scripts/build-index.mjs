#!/usr/bin/env node
// Build the static catalog data the site reads (docs/SITE-SPEC.md). Everything is computed here, at
// build time, from the repository; the site computes nothing it could not compute from these files.
//
//   node scripts/build-index.mjs [--root <dir>] [--out <dir>] [--site-url <url>]
//
// Writes to <out> (default site/public):
//   index.json     plugins and artifacts (skills, agents) with manifest data and "used by" links
//   search.json    the search corpus: id + plain text of README / body, one row per document
//   releases.json  CHANGELOG sections, newest first
//   stats.json     bytes and estimated tokens per artifact and per plugin (context-cost view)
//   bodies/*.md    raw Markdown for plugin READMEs and artifact bodies, loaded lazily
//   feed.xml       Atom 1.0 feed of releases
//   catalog.html   no-JS plugin list, injected into index.html by the site build
// Exits 1 when a marketplace entry and its manifest disagree, or a dependency is not in the marketplace.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { loadMarketplace, asList, walk, readJson } from './lib/repo.mjs';

export const DEFAULT_SITE_URL = 'https://pereplut.github.io/dev-digest-ai-marketplace/';
export const DEFAULT_REPO = 'Pereplut/dev-digest-ai-marketplace';

/** Rough token estimate: ~4 characters per token for English Markdown. Labelled "est." in the UI. */
export const estimateTokens = (text) => Math.ceil(text.length / 4);

/** Parse Keep-a-Changelog sections: `## [1.2.0] - 2026-10-16` followed by notes until the next `## `. */
export function parseChangelog(text) {
  const out = [];
  const re = /^## \[?(\d+\.\d+\.\d+)\]?(?:\s*-\s*(\d{4}-\d{2}-\d{2}))?.*$/gm;
  const heads = [...text.matchAll(re)];
  heads.forEach((m, i) => {
    const end = i + 1 < heads.length ? heads[i + 1].index : text.length;
    out.push({ version: m[1], date: m[2] ?? null, notes: text.slice(m.index + m[0].length, end).trim() });
  });
  return out;
}

/** Minimum Claude Code version from a COMPATIBILITY.md table row `| Claude Code | \`>=2.1.110\` |`. */
export function parseCompatibility(text) {
  const m = /^\|\s*Claude Code\s*\|\s*`?\s*>=?\s*(\d+\.\d+\.\d+)\s*`?\s*\|/im.exec(text ?? '');
  const tested = /^\|\s*Tested on\s*\|\s*([^|]+?)\s*\|/im.exec(text ?? '');
  return { minClaudeCode: m ? m[1] : null, testedOn: tested ? tested[1].replace(/`/g, '') : null };
}

/** Markdown to rough plain text for the search corpus (no rendering, no HTML). */
export function plainText(md) {
  return md
    .replace(/```[\s\S]*?```/g, (b) => b.replace(/```\w*/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`|~-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const read = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const depName = (d) => (typeof d === 'string' ? d : d.name);
const depRange = (d) => (typeof d === 'string' ? '*' : d.version ?? '*');
const fileId = (id) => id.replace(':', '__');

function gitTags(root) {
  try {
    return execFileSync('git', ['-C', root, 'tag', '--list'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').filter(Boolean);
  } catch {
    return [];
  }
}

function gitShow(root, ref, path) {
  try {
    return execFileSync('git', ['-C', root, 'show', `${ref}:${path}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/** Errors that make the catalog lie about the manifests (AC-13). */
export function consistencyErrors(plugins) {
  const errors = [];
  const names = new Set(plugins.map((p) => p.entry.name));
  for (const p of plugins) {
    if (!p.manifest) { errors.push(`${p.entry.name}: no .claude-plugin/plugin.json under ${p.rel}`); continue; }
    if (p.manifest.name !== p.entry.name) errors.push(`marketplace entry "${p.entry.name}" != plugin.json name "${p.manifest.name}"`);
    for (const d of p.manifest.dependencies ?? []) {
      if (!names.has(depName(d))) errors.push(`${p.entry.name}: dependency "${depName(d)}" is not in the marketplace`);
    }
  }
  return errors;
}

/** Stable channel pins: plugin name -> pinned version, read from the ref `<plugin>--v<version>`. */
function stablePins(root) {
  const p = join(root, 'channels', 'stable', '.claude-plugin', 'marketplace.json');
  if (!existsSync(p)) return { name: null, pins: {} };
  const stable = readJson(p);
  const pins = {};
  for (const e of stable.plugins ?? []) {
    const m = /--v(\d+\.\d+\.\d+)$/.exec(e.source?.ref ?? '');
    if (m) pins[e.name] = { version: m[1], ref: e.source.ref, sha: e.source.sha ?? null };
  }
  return { name: stable.name, pins };
}

export function buildIndex(root, { siteUrl = DEFAULT_SITE_URL, repo = DEFAULT_REPO } = {}) {
  root = resolve(root);
  const { marketplace, plugins } = loadMarketplace(root);
  const errors = consistencyErrors(plugins);
  if (errors.length) return { errors };

  const tags = gitTags(root);
  const stable = stablePins(root);
  const bodies = {};
  const search = [];
  const artifacts = [];
  const pluginRows = [];
  const releases = [];
  const compatibility = [];
  const stats = { method: 'tokens ≈ characters / 4', artifacts: {}, plugins: {} };

  for (const p of plugins) {
    const m = p.manifest;
    const readme = read(join(p.dir, 'README.md'));
    const changelog = read(join(p.dir, 'CHANGELOG.md'));
    const compatText = read(join(p.dir, 'COMPATIBILITY.md'));
    const compat = parseCompatibility(compatText);
    bodies[`${p.entry.name}.md`] = readme;
    bodies[`${p.entry.name}.changelog.md`] = changelog;
    bodies[`${p.entry.name}.compatibility.md`] = compatText;

    const components = p.components.map((c) => {
      const id = `${p.entry.name}:${c.name}`;
      const manual = c.data['disable-model-invocation'] === true;
      // Every file in a skill's folder ships with it; only SKILL.md loads on invocation.
      const supporting = c.type === 'skill'
        ? walk(dirname(c.path)).filter((f) => f !== c.path).map((f) => ({ path: relative(p.dir, f), bytes: statSync(f).size }))
        : [];
      const description = String(c.data.description ?? '');
      const row = {
        id,
        type: c.type,
        plugin: p.entry.name,
        name: c.name,
        description,
        keywords: m.keywords ?? [],
        version: m.version,
        tools: asList(c.data.tools),
        disallowedTools: asList(c.data.disallowedTools),
        model: c.data.model ?? null,
        skills: asList(c.data.skills),
        manual,
        argumentHint: c.data['argument-hint'] ?? null,
        invocation: c.type === 'skill' ? `/${id}` : `@agent-${id}`,
        path: relative(root, c.path),
        bodyPath: `bodies/${fileId(id)}.md`,
        supporting: supporting.map((s) => s.path),
        usedBy: [],
      };
      bodies[`${fileId(id)}.md`] = c.body;
      search.push({ id, text: plainText(c.body) });
      const supportBytes = supporting.reduce((n, s) => n + s.bytes, 0);
      stats.artifacts[id] = {
        bytes: Buffer.byteLength(c.text),
        tokens: estimateTokens(c.text),
        // What every session pays for discovery: the description sits in context even when unused.
        // Manual-only skills are not listed to the model, so they cost nothing until invoked.
        discoveryTokens: manual ? 0 : estimateTokens(`${c.name}: ${description}`),
        supportingBytes: supportBytes,
        supportingTokens: Math.ceil(supportBytes / 4),
      };
      return { row, text: c.text };
    });
    artifacts.push(...components.map((c) => c.row));

    const own = components.map((c) => stats.artifacts[c.row.id]);
    stats.plugins[p.entry.name] = {
      artifacts: own.length,
      skills: components.filter((c) => c.row.type === 'skill').length,
      agents: components.filter((c) => c.row.type === 'agent').length,
      bytes: own.reduce((n, s) => n + s.bytes + s.supportingBytes, 0),
      tokens: own.reduce((n, s) => n + s.tokens, 0),
      discoveryTokens: own.reduce((n, s) => n + s.discoveryTokens, 0),
      readmeTokens: estimateTokens(readme),
    };

    for (const r of parseChangelog(changelog)) releases.push({ plugin: p.entry.name, ...r, tag: `${p.entry.name}--v${r.version}`, tagged: tags.includes(`${p.entry.name}--v${r.version}`) });

    // Compatibility per released version: read COMPATIBILITY.md at its tag when the tag exists;
    // the working tree describes the current manifest version.
    const versions = new Set([m.version, ...parseChangelog(changelog).map((r) => r.version)]);
    for (const v of versions) {
      const tag = `${p.entry.name}--v${v}`;
      const atTag = tags.includes(tag) ? gitShow(root, tag, `${p.rel}/COMPATIBILITY.md`) : null;
      const c = atTag != null ? parseCompatibility(atTag) : v === m.version ? compat : { minClaudeCode: null, testedOn: null };
      compatibility.push({ plugin: p.entry.name, version: v, ...c, source: atTag != null ? tag : v === m.version ? 'working tree' : 'unknown' });
    }

    search.push({ id: p.entry.name, text: plainText(readme) });
    pluginRows.push({
      name: p.entry.name,
      version: m.version,
      description: m.description ?? p.entry.description ?? '',
      summary: p.entry.description ?? m.description ?? '',
      category: p.entry.category ?? null,
      tags: p.entry.tags ?? [],
      keywords: m.keywords ?? [],
      author: m.author ?? marketplace.owner ?? null,
      license: m.license ?? null,
      homepage: m.homepage ?? null,
      repository: m.repository ?? null,
      dependencies: (m.dependencies ?? []).map((d) => ({ name: depName(d), version: depRange(d) })),
      dependents: [],
      components: components.map((c) => c.row.id),
      minClaudeCode: compat.minClaudeCode,
      testedOn: compat.testedOn,
      stable: stable.pins[p.entry.name] ?? null,
      path: p.rel,
      readmePath: `bodies/${p.entry.name}.md`,
    });
  }

  // Reverse edges: plugin dependents, and artifact "used by" from namespaced references in bodies
  // and `skills:` frontmatter.
  for (const p of pluginRows) for (const d of p.dependencies) pluginRows.find((x) => x.name === d.name)?.dependents.push(p.name);
  const byId = new Map(artifacts.map((a) => [a.id, a]));
  for (const p of plugins) {
    for (const c of p.components) {
      const from = `${p.entry.name}:${c.name}`;
      // `@agent-plugin:name` mentions count too; drop the prefix so the id parses.
      const refs = new Set([...c.text.replace(/@agent-/g, ' ').matchAll(/\b([a-z0-9-]+:[a-z0-9-]+)\b/g)].map((m) => m[1]));
      for (const s of asList(c.data.skills)) refs.add(s);
      for (const ref of refs) if (ref !== from && byId.has(ref)) byId.get(ref).usedBy.push(from);
    }
  }
  for (const a of artifacts) a.usedBy = [...new Set(a.usedBy)].sort();

  releases.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '') || a.plugin.localeCompare(b.plugin));
  const tagsSeen = [...new Set(pluginRows.flatMap((p) => p.tags))].sort();
  const index = {
    generatedAt: new Date().toISOString(),
    marketplace: { name: marketplace.name, description: marketplace.description, owner: marketplace.owner, repo, siteUrl },
    channels: { latest: marketplace.name, stable: stable.name },
    tags: tagsSeen,
    plugins: pluginRows,
    artifacts,
    compatibility,
  };
  return { errors: [], index, search, releases, stats, bodies, feed: atomFeed(index, releases), catalogHtml: catalogHtml(index) };
}

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function atomFeed(index, releases) {
  const site = index.marketplace.siteUrl;
  const updated = releases.map((r) => r.date).filter(Boolean).sort().at(-1) ?? '1970-01-01';
  const entries = releases.map((r) => `  <entry>
    <id>${esc(`${site}#/whats-new/${r.plugin}/${r.version}`)}</id>
    <title>${esc(`${r.plugin} ${r.version}`)}</title>
    <updated>${r.date ?? updated}T00:00:00Z</updated>
    <link rel="alternate" href="${esc(`${site}#/plugin/${r.plugin}`)}"/>
    <content type="text">${esc(r.notes)}</content>
  </entry>`).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${esc(site)}</id>
  <title>${esc(index.marketplace.name)} releases</title>
  <updated>${updated}T00:00:00Z</updated>
  <author><name>${esc(index.marketplace.owner?.name ?? index.marketplace.name)}</name></author>
  <link rel="self" href="${esc(`${site}feed.xml`)}"/>
  <link rel="alternate" href="${esc(site)}"/>
${entries}
</feed>
`;
}

/** Static plugin list for no-JS visitors and crawlers (AC-12). React replaces it on mount. */
export function catalogHtml(index) {
  const items = index.plugins.map((p) => `      <li>
        <h2><a href="#/plugin/${esc(p.name)}">${esc(p.name)}</a> <small>v${esc(p.version)}</small></h2>
        <p>${esc(p.summary)}</p>
        <pre><code>/plugin install ${esc(p.name)}@${esc(index.marketplace.name)}</code></pre>
      </li>`).join('\n');
  return `<main class="static-catalog">
    <h1>${esc(index.marketplace.name)}</h1>
    <p>${esc(index.marketplace.description)}</p>
    <pre><code>/plugin marketplace add ${esc(index.marketplace.repo)}</code></pre>
    <ul>
${items}
    </ul>
  </main>`;
}

export function writeIndex(result, out) {
  rmSync(join(out, 'bodies'), { recursive: true, force: true });
  mkdirSync(join(out, 'bodies'), { recursive: true });
  const json = (name, v) => writeFileSync(join(out, name), JSON.stringify(v, null, 1) + '\n');
  json('index.json', result.index);
  json('search.json', result.search);
  json('releases.json', result.releases);
  json('stats.json', result.stats);
  for (const [name, body] of Object.entries(result.bodies)) writeFileSync(join(out, 'bodies', name), body);
  writeFileSync(join(out, 'feed.xml'), result.feed);
  writeFileSync(join(out, 'catalog.html'), result.catalogHtml);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  const opt = (k, d) => { const i = args.indexOf(k); return i < 0 ? d : args[i + 1]; };
  const root = resolve(opt('--root', process.cwd()));
  const out = resolve(opt('--out', join(root, 'site', 'public')));
  const result = buildIndex(root, { siteUrl: opt('--site-url', process.env.SITE_URL ?? DEFAULT_SITE_URL) });
  if (result.errors.length) {
    for (const e of result.errors) console.error(`  ✗ ${e}`);
    console.error(`build-index: ${result.errors.length} error(s); catalog not written`);
    process.exit(1);
  }
  writeIndex(result, out);
  const { plugins, artifacts } = result.index;
  console.log(`build-index: ${plugins.length} plugins, ${artifacts.length} artifacts, ${result.releases.length} releases -> ${relative(process.cwd(), out) || '.'}`);
}
