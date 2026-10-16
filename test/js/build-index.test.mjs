// Unit tests for scripts/build-index.mjs (docs/SITE-SPEC.md AC-4, AC-9, AC-10, AC-11, AC-12, AC-13).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildIndex, parseChangelog, parseCompatibility, estimateTokens, writeIndex } from '../../scripts/build-index.mjs';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const SCRIPT = join(REPO, 'scripts/build-index.mjs');

function put(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'idx-'));
  put(root, '.claude-plugin/marketplace.json', {
    name: 'mkt', owner: { name: 'o' }, description: 'd',
    plugins: [{ name: 'base', source: './plugins/base', tags: ['a'] }, { name: 'app', source: './plugins/app' }],
  });
  put(root, 'plugins/base/.claude-plugin/plugin.json', { name: 'base', version: '1.2.0' });
  put(root, 'plugins/base/README.md', '# base\n');
  put(root, 'plugins/base/CHANGELOG.md', '# Changelog\n\n## [1.2.0] - 2026-10-10\n\n### Fixed\n- b\n\n## [1.0.0] - 2026-09-01\n\n### Added\n- a\n');
  put(root, 'plugins/base/COMPATIBILITY.md', '| Requirement | Value |\n|---|---|\n| Claude Code | `>=2.1.200` |\n');
  put(root, 'plugins/base/skills/rules/SKILL.md', '---\nname: rules\ndescription: The rules.\n---\nBody of rules.\n');
  put(root, 'plugins/base/skills/rules/reference.md', 'x'.repeat(400));
  put(root, 'plugins/app/.claude-plugin/plugin.json', { name: 'app', version: '2.0.0', dependencies: [{ name: 'base', version: '^1.2.0' }] });
  put(root, 'plugins/app/README.md', '# app\n');
  put(root, 'plugins/app/CHANGELOG.md', '## [2.0.0] - 2026-10-12\n- x\n');
  put(root, 'plugins/app/agents/worker.md', '---\nname: worker\ndescription: Works.\ntools: Read, Grep\n---\nLoad `base:rules` first.\n');
  put(root, 'plugins/app/skills/go/SKILL.md', '---\nname: go\ndescription: Manual.\ndisable-model-invocation: true\n---\nRun @agent-app:worker.\n');
  return root;
}

test('parseChangelog: versions, dates and notes, in file order', () => {
  const r = parseChangelog('# C\n\n## [Unreleased]\n- u\n\n## [1.1.0] - 2026-10-16\n### Added\n- y\n\n## 1.0.0\n- x\n');
  assert.deepEqual(r.map((x) => [x.version, x.date]), [['1.1.0', '2026-10-16'], ['1.0.0', null]]);
  assert.equal(r[0].notes, '### Added\n- y');
});

test('parseCompatibility: minimum and tested-on rows (AC-10)', () => {
  assert.deepEqual(parseCompatibility('| Claude Code | `>=2.1.110` |\n| Tested on | Claude Code 2.1.301 |'), { minClaudeCode: '2.1.110', testedOn: 'Claude Code 2.1.301' });
  assert.deepEqual(parseCompatibility('nothing'), { minClaudeCode: null, testedOn: null });
});

test('index matches the manifests exactly (AC-4)', () => {
  const { errors, index } = buildIndex(fixture());
  assert.deepEqual(errors, []);
  const app = index.plugins.find((p) => p.name === 'app');
  assert.equal(app.version, '2.0.0');
  assert.deepEqual(app.dependencies, [{ name: 'base', version: '^1.2.0' }]);
  assert.deepEqual(index.plugins.find((p) => p.name === 'base').dependents, ['app']);
  assert.deepEqual(index.artifacts.map((a) => a.id).sort(), ['app:go', 'app:worker', 'base:rules']);
  const worker = index.artifacts.find((a) => a.id === 'app:worker');
  assert.deepEqual(worker.tools, ['Read', 'Grep']);
  assert.equal(worker.invocation, '@agent-app:worker');
  assert.deepEqual(index.artifacts.find((a) => a.id === 'base:rules').usedBy, ['app:worker']);
  assert.deepEqual(index.artifacts.find((a) => a.id === 'app:worker').usedBy, ['app:go']);
});

test('the real repository index matches every plugin.json (AC-4)', () => {
  const { errors, index } = buildIndex(REPO);
  assert.deepEqual(errors, []);
  for (const p of index.plugins) {
    const m = JSON.parse(readFileSync(join(REPO, p.path, '.claude-plugin/plugin.json'), 'utf8'));
    assert.equal(p.version, m.version, p.name);
    assert.deepEqual(p.dependencies, (m.dependencies ?? []).map((d) => ({ name: d.name, version: d.version })), p.name);
  }
  // AC-2 data side: the nested skill is indexed with its parent plugin.
  assert.equal(index.artifacts.find((a) => a.name === 'onion-architecture').plugin, 'engineering-paved-path');
});

test('releases newest first; Atom feed has one entry per release (AC-9)', () => {
  const { releases, feed } = buildIndex(fixture());
  assert.deepEqual(releases.map((r) => `${r.plugin}@${r.version}`), ['app@2.0.0', 'base@1.2.0', 'base@1.0.0']);
  assert.match(feed, /^<\?xml version="1.0" encoding="utf-8"\?>\n<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
  assert.equal(feed.match(/<entry>/g).length, 3);
  for (const tag of ['id', 'title', 'updated']) assert.match(feed, new RegExp(`<feed[\\s\\S]*?<${tag}>`));
  assert.match(feed, /<updated>2026-10-12T00:00:00Z<\/updated>/);
});

test('compatibility rows per version; untagged old versions are unknown (AC-10)', () => {
  const { index } = buildIndex(fixture());
  const base = index.compatibility.filter((c) => c.plugin === 'base');
  assert.deepEqual(base.map((c) => [c.version, c.minClaudeCode, c.source]), [['1.2.0', '2.1.200', 'working tree'], ['1.0.0', null, 'unknown']]);
});

test('compatibility is read at the release tag when the tag exists (AC-10)', () => {
  const root = fixture();
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { stdio: 'ignore' });
  git('init', '-q');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'add', '-A');
  git('-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-qm', 'x');
  git('tag', 'base--v1.0.0');
  put(root, 'plugins/base/COMPATIBILITY.md', '| Claude Code | `>=2.1.250` |\n');
  const { index, releases } = buildIndex(root);
  const base = Object.fromEntries(index.compatibility.filter((c) => c.plugin === 'base').map((c) => [c.version, c]));
  assert.equal(base['1.0.0'].minClaudeCode, '2.1.200');
  assert.equal(base['1.0.0'].source, 'base--v1.0.0');
  assert.equal(base['1.2.0'].minClaudeCode, '2.1.250');
  assert.equal(releases.find((r) => r.tag === 'base--v1.0.0').tagged, true);
});

test('stats: body tokens, discovery tokens, supporting files; manual skills cost no discovery (AC-11)', () => {
  const { stats } = buildIndex(fixture());
  const rules = stats.artifacts['base:rules'];
  assert.equal(rules.tokens, estimateTokens(readFileSync(join(fixture(), 'plugins/base/skills/rules/SKILL.md'), 'utf8')));
  assert.equal(rules.supportingBytes, 400);
  assert.equal(rules.supportingTokens, 100);
  assert.ok(rules.discoveryTokens > 0);
  assert.equal(stats.artifacts['app:go'].discoveryTokens, 0);
  assert.deepEqual([stats.plugins.app.skills, stats.plugins.app.agents], [1, 1]);
});

test('no-JS catalog lists every plugin with its install command (AC-12)', () => {
  const { catalogHtml } = buildIndex(fixture());
  for (const n of ['base', 'app']) assert.ok(catalogHtml.includes(`/plugin install ${n}@mkt`), n);
});

test('writeIndex writes every output file', () => {
  const out = mkdtempSync(join(tmpdir(), 'out-'));
  writeIndex(buildIndex(fixture()), out);
  assert.deepEqual(readdirSync(out).sort(), ['bodies', 'catalog.html', 'feed.xml', 'index.json', 'releases.json', 'search.json', 'stats.json']);
  assert.ok(readdirSync(join(out, 'bodies')).includes('base__rules.md'));
});

test('a name mismatch or unknown dependency exits 1 and writes nothing (AC-13)', () => {
  const root = fixture();
  put(root, 'plugins/app/.claude-plugin/plugin.json', { name: 'app-renamed', version: '1.0.0', dependencies: [{ name: 'ghost', version: '^1.0.0' }] });
  const out = join(root, 'out');
  const r = spawnSync(process.execPath, [SCRIPT, '--root', root, '--out', out], { encoding: 'utf8' });
  assert.equal(r.status, 1);
  assert.match(r.stderr, /!= plugin.json name "app-renamed"/);
  assert.match(r.stderr, /dependency "ghost" is not in the marketplace/);
  assert.throws(() => readdirSync(out));
});
