// Unit tests for repo tooling: semver ranges, portability lint, manifest checks, stable-channel pinning,
// deps-released gate.   node --test "test/js/**/*.test.mjs"
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { satisfies, parseFrontmatter } from '../../scripts/lib/repo.mjs';
import { lint } from '../../scripts/lint-portability.mjs';
import { check } from '../../scripts/check-manifests.mjs';
import { pin } from '../../scripts/pin-stable.mjs';
import { unmet } from '../../scripts/check-deps-released.mjs';
import { checkSuite } from '../../scripts/check-evals.mjs';

function put(root, rel, content) {
  const p = join(root, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, typeof content === 'string' ? content : JSON.stringify(content, null, 2));
}

/** A valid two-plugin marketplace: app depends on base, app's agent references base:rules. */
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'mkt-'));
  put(root, '.claude-plugin/marketplace.json', {
    name: 'test-market', owner: { name: 'x' }, description: 'd',
    plugins: [{ name: 'base', source: './plugins/base' }, { name: 'app', source: './plugins/app' }],
  });
  for (const n of ['base', 'app']) for (const f of ['README.md', 'CHANGELOG.md', 'COMPATIBILITY.md']) put(root, `plugins/${n}/${f}`, `# ${n}\n`);
  put(root, 'plugins/base/.claude-plugin/plugin.json', { name: 'base', version: '1.2.0' });
  put(root, 'plugins/base/skills/rules/SKILL.md', '---\nname: rules\ndescription: Rules.\n---\nBody\n');
  put(root, 'plugins/app/.claude-plugin/plugin.json', { name: 'app', version: '1.0.0', dependencies: [{ name: 'base', version: '^1.0.0' }] });
  put(root, 'plugins/app/agents/plan-verifier.md', '---\nname: plan-verifier\ndescription: >-\n  Verifies.\n  Twice.\ntools: Read, Grep\ndisallowedTools: Write, Edit\n---\nLoad `base:rules` first.\n');
  return root;
}

test('satisfies: caret, tilde, gte, exact', () => {
  assert.ok(satisfies('1.4.0', '^1.0.0'));
  assert.ok(!satisfies('2.0.0', '^1.0.0'));
  assert.ok(!satisfies('0.3.0', '^0.2.0'));
  assert.ok(satisfies('1.2.9', '~1.2.0'));
  assert.ok(!satisfies('1.3.0', '~1.2.0'));
  assert.ok(satisfies('3.0.0', '>=1.4.0'));
  assert.ok(satisfies('1.0.0', '=1.0.0') && satisfies('1.0.0', '1.0.0'));
});

test('parseFrontmatter: folded block, inline list, booleans', () => {
  const { data } = parseFrontmatter('---\nname: a\ndescription: >-\n  one\n  two\nskills: [x:y, z]\ndisable-model-invocation: true\n---\nbody');
  assert.equal(data.description, 'one two');
  assert.deepEqual(data.skills, ['x:y', 'z']);
  assert.equal(data['disable-model-invocation'], true);
});

test('check-manifests: valid fixture passes', () => {
  assert.deepEqual(check(fixture()).errors, []);
});

test('check-manifests: name mismatch, entry version, missing dep, undeclared reference', () => {
  const root = fixture();
  const mp = JSON.parse(readFileSync(join(root, '.claude-plugin/marketplace.json'), 'utf8'));
  mp.plugins[0].version = '1.0.0';
  put(root, '.claude-plugin/marketplace.json', mp);
  put(root, 'plugins/app/.claude-plugin/plugin.json', { name: 'app-renamed', version: '1.0.0' });
  const errors = check(root).errors.join('\n');
  assert.match(errors, /sets "version"/);
  assert.match(errors, /!= plugin.json name "app-renamed"/);
  assert.match(errors, /does not depend on base/);
});

test('check-manifests: read-only agent must disallow Write/Edit; forbidden fields', () => {
  const root = fixture();
  put(root, 'plugins/app/agents/plan-verifier.md', '---\nname: plan-verifier\ndescription: V.\ntools: Read, Write\nhooks: x\n---\nbody\n');
  const errors = check(root).errors.join('\n');
  assert.match(errors, /must disallow Write/);
  assert.match(errors, /may not set "hooks"/);
});

test('check-manifests: unsatisfied dependency range', () => {
  const root = fixture();
  put(root, 'plugins/app/.claude-plugin/plugin.json', { name: 'app', version: '1.0.0', dependencies: [{ name: 'base', version: '^2.0.0' }] });
  assert.match(check(root).errors.join('\n'), /not satisfied by current 1.2.0/);
});

test('lint-portability: clean fixture passes, planted problems are caught (AC-6, AC-7, AC-8)', () => {
  const root = fixture();
  assert.deepEqual(lint(root), []);
  put(root, 'plugins/app/skills/bad/SKILL.md', [
    '---', 'name: bad', 'description: d', '---',
    'See /home/alice/project/notes.md',
    'Run tests in `server/` first.',
    'Опис українською',
    'token sk-ant-abcdefghijklmnop',
    'Read .claude/skills/foo/SKILL.md',
    '[x](../../../../docs/outside.md)',
    'Built for DevDigest.',
    'Install from dev-digest-ai-marketplace is fine.',
  ].join('\n'));
  const rules = new Set(lint(root).map((p) => p.rule));
  for (const r of ['absolute-path', 'product-dir', 'english-only', 'secret', 'local-layout', 'escapes-plugin', 'product-name']) assert.ok(rules.has(r), r);
  assert.equal(lint(root).filter((p) => p.text.includes('is fine')).length, 0);
});

test('lint-portability: docs are checked for English only', () => {
  const root = fixture();
  put(root, 'docs/X.md', 'server/ is fine in docs\nПривіт\n');
  assert.deepEqual(lint(root).map((p) => p.rule), ['english-only']);
});

test('pin-stable: writes a git-subdir entry pinned to tag and sha, keeps order', () => {
  const root = fixture();
  const sha = 'a'.repeat(40);
  pin({ root, plugin: 'app', version: '1.0.0', sha, repoUrl: 'https://example.com/m.git' });
  pin({ root, plugin: 'base', version: '1.2.0', sha });
  const stable = JSON.parse(readFileSync(join(root, 'channels/stable/.claude-plugin/marketplace.json'), 'utf8'));
  assert.equal(stable.name, 'dev-digest-ai-marketplace-stable');
  assert.deepEqual(stable.plugins.map((p) => p.name), ['base', 'app']);
  assert.deepEqual(stable.plugins[1].source, { source: 'git-subdir', url: 'https://example.com/m.git', path: 'plugins/app', ref: 'app--v1.0.0', sha });
  assert.throws(() => pin({ root, plugin: 'app', version: '1.0.0', sha: 'abc' }), /40-character/);
});

test('check-deps-released: needs a satisfying tag per dependency', () => {
  const manifest = { dependencies: [{ name: 'base', version: '^1.0.0' }] };
  assert.equal(unmet(manifest, ['base--v0.9.0', 'app--v1.0.0']).length, 1);
  assert.deepEqual(unmet(manifest, ['base--v1.3.1']), []);
  assert.deepEqual(unmet({}, []), []);
});

test('build-eval-fixtures: scaffold writes base + overlays, commits, then applies the uncommitted change', async () => {
  const { renderScaffold } = await import('../../scripts/build-eval-fixtures.mjs');
  const { execFileSync } = await import('node:child_process');
  const fx = mkdtempSync(join(tmpdir(), 'fx-'));
  put(fx, 'base/a.txt', "it's base\n");
  put(fx, 'base/dir/b.txt', 'b\n');
  put(fx, 'overlays/over/a.txt', 'overlaid\n');
  put(fx, 'overlays/late/dir/b.txt', 'changed after commit\n');
  const script = renderScaffold(fx, { fixture: 'base', overlays: ['over'], git: true, after_commit: ['late'] }, 'case-x');
  assert.match(script, /^#!\/usr\/bin\/env bash\n# GENERATED/);
  // The runner keeps the script in the case directory, outside the workspace it seeds.
  const caseDir = mkdtempSync(join(tmpdir(), 'case-'));
  const ws = mkdtempSync(join(tmpdir(), 'ws-'));
  put(caseDir, 'fixture.sh', script);
  execFileSync('bash', [join(caseDir, 'fixture.sh')], { cwd: ws, env: { PATH: process.env.PATH, HOME: ws } });
  assert.equal(readFileSync(join(ws, 'a.txt'), 'utf8'), 'overlaid\n');
  assert.equal(execFileSync('git', ['status', '--porcelain'], { cwd: ws, encoding: 'utf8' }).trim(), 'M dir/b.txt');
  assert.equal(execFileSync('git', ['show', 'HEAD:dir/b.txt'], { cwd: ws, encoding: 'utf8' }), 'b\n');
  assert.throws(() => renderScaffold(fx, { fixture: 'missing' }, 'c'), /not found/);
});

test('check-evals: every case must load the plugin and its dependencies', () => {
  const root = fixture();
  const grader = '---\ntype: regex\npattern: ok\n---\n';
  put(root, 'plugins/app/evals/good/prompt.md', '---\nplugins: ["../..", "../../../base"]\n---\nDo it.\n');
  put(root, 'plugins/app/evals/good/graders/g.md', grader);
  put(root, 'plugins/app/evals/no-dep/case.yaml', 'schema_version: "1.1"\nname: no-dep\nplugins: ["../.."]\n');
  put(root, 'plugins/app/evals/no-dep/prompt.md', 'Do it.\n');
  put(root, 'plugins/app/evals/no-dep/graders/g.md', grader);
  const { errors } = checkSuite(join(root, 'plugins/app/evals'), ['base']);
  assert.deepEqual(errors, ['no-dep: plugins: does not list dependency base (the plugin would be rejected as dependency-unsatisfied)']);
  assert.deepEqual(checkSuite(join(root, 'plugins/app/evals')).errors, [], 'no dependencies: nothing to check');
});

test('eval-usage: sums modelUsage over models, counts tool calls, marks a missing trace', async () => {
  const { traceUsage, summarize } = await import('../../scripts/eval-usage.mjs');
  const trace = [
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use' }, { type: 'text' }] } }),
    JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use' }] } }),
    JSON.stringify({ type: 'result', modelUsage: { a: { inputTokens: 1, outputTokens: 10, cacheReadInputTokens: 100, cacheCreationInputTokens: 5 }, b: { inputTokens: 2, outputTokens: 20 } } }),
  ].join('\n');
  assert.deepEqual(traceUsage(trace), { input: 3, output: 30, cacheRead: 100, cacheWrite: 5, toolCalls: 2 });
  assert.equal(traceUsage('not json\n'), null);
  const result = { cases: [{ name: 'c', arms: { with: [
    { tracePath: 't1', costUsd: 0.2, durationSeconds: 10 },
    { tracePath: 'gone', costUsd: 0.4, durationSeconds: 30 },
  ] } }] };
  const [row] = summarize(result, (p) => (p === 't1' ? trace : null));
  assert.equal(row.traced, 1);
  assert.equal(row.output, 30);
  assert.equal(row.cost, 0.30000000000000004);
});

test('check-stable-deps: every dependency pinned in range, read from the pinned commit', async () => {
  const { checkStable } = await import('../../scripts/check-stable-deps.mjs');
  const entry = (name, v) => ({ name, source: { source: 'git-subdir', path: `plugins/${name}`, ref: `${name}--v${v}`, sha: 'a'.repeat(40) } });
  const manifests = { app: { dependencies: [{ name: 'base', version: '^1.0.0' }] }, base: {} };
  const read = (sha, path) => manifests[path.split('/')[1]];
  assert.deepEqual(checkStable({ plugins: [entry('base', '1.2.0'), entry('app', '1.0.0')] }, read), []);
  assert.deepEqual(checkStable({ plugins: [entry('app', '1.0.0')] }, read), ['app 1.0.0 needs base ^1.0.0, which the stable channel does not pin']);
  assert.deepEqual(checkStable({ plugins: [entry('base', '2.0.0'), entry('app', '1.0.0')] }, read), ['app 1.0.0 needs base ^1.0.0; stable pins 2.0.0']);
  assert.match(checkStable({ plugins: [{ name: 'x', source: './plugins/x' }] }, read)[0], /not pinned/);
});
