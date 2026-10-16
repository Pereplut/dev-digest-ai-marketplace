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
