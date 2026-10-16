#!/usr/bin/env node
// Static check of every plugin's eval suite against the documented `claude plugin eval` schema
// (code.claude.com/docs/en/plugin-evals). The CLI validates prompt.md frontmatter when it loads a
// suite, but on 2.1.301 a grader with an unknown `type` loads silently and only fails mid-run, after
// tokens are spent. This catches that for free.
//
// It also checks that every case loads the plugin's dependencies. The eval loads only the plugin dirs a
// case lists in `plugins:`, and a plugin whose dependencies are missing is rejected as
// dependency-unsatisfied. The run then goes on with no plugin, and every negative case passes for
// the wrong reason (docs/COST-BASELINE.md, Known gaps).
//
//   node scripts/check-evals.mjs [--root <dir>]
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseFrontmatter } from './lib/repo.mjs';

const PROMPT_KEYS = new Set(['schema_version', 'name', 'description', 'tags', 'plugins', 'runs', 'expected_outcome', 'model', 'max_turns', 'timeout_seconds', 'allowed_tools', 'disallowed_tools', 'append_system_prompt', 'env']);
const COMMON = ['type', 'weight', 'arm'];
const GRADER_KEYS = {
  regex: ['pattern', 'flags', 'match', 'target'],
  tool_used: ['tool', 'input_match', 'min', 'max'],
  tool_order: ['before', 'after'],
  file_exists: ['path', 'exists'],
  llm: ['criteria', 'focus'],
  baseline: ['baseline_file', 'criteria'],
};

export function checkSuite(evalsDir, deps = []) {
  const errors = [];
  const pluginDir = resolve(evalsDir, '..');
  const caseDirs = readdirSync(evalsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && d.name !== 'fixtures' && d.name !== 'results' && d.name !== 'mocks')
    .map((d) => join(evalsDir, d.name));
  for (const dir of caseDirs) {
    const name = relative(evalsDir, dir);
    const prompt = join(dir, 'prompt.md');
    const caseYaml = join(dir, 'case.yaml');
    if (!existsSync(prompt) && !existsSync(caseYaml)) { errors.push(`${name}: no prompt.md or case.yaml`); continue; }
    if (existsSync(prompt)) {
      const { data, body } = parseFrontmatter(readFileSync(prompt, 'utf8'));
      for (const k of Object.keys(data)) if (!PROMPT_KEYS.has(k)) errors.push(`${name}/prompt.md: unknown key "${k}"`);
      if (!body.trim()) errors.push(`${name}/prompt.md: empty prompt`);
    }
    if (existsSync(caseYaml)) {
      const m = /scaffold_script:\s*(\S+)/.exec(readFileSync(caseYaml, 'utf8'));
      if (m && !existsSync(join(dir, m[1]))) errors.push(`${name}/case.yaml: scaffold_script ${m[1]} does not exist`);
    }
    if (deps.length) {
      const listed = loadedPlugins(dir, prompt, caseYaml);
      const names = listed.map((p) => resolve(dir, p));
      if (!names.includes(pluginDir)) errors.push(`${name}: plugins: does not list the plugin under test (${relative(dir, pluginDir)})`);
      for (const d of deps) {
        if (!names.includes(resolve(pluginDir, '..', d))) errors.push(`${name}: plugins: does not list dependency ${d} (the plugin would be rejected as dependency-unsatisfied)`);
      }
    }
    const gdir = join(dir, 'graders');
    const graders = existsSync(gdir) ? readdirSync(gdir).filter((f) => f.endsWith('.md')) : [];
    if (!graders.length && !(existsSync(caseYaml) && /^graders:/m.test(readFileSync(caseYaml, 'utf8')))) errors.push(`${name}: no graders (the case would fail to load)`);
    for (const g of graders) {
      const { data, body } = parseFrontmatter(readFileSync(join(gdir, g), 'utf8'));
      const where = `${name}/graders/${g}`;
      const allowed = GRADER_KEYS[data.type];
      if (!allowed) { errors.push(`${where}: unknown type "${data.type}" (expected ${Object.keys(GRADER_KEYS).join(', ')})`); continue; }
      for (const k of Object.keys(data)) if (!COMMON.includes(k) && !allowed.includes(k)) errors.push(`${where}: key "${k}" is not valid for type ${data.type}`);
      if (data.arm && !['with-only', 'both'].includes(data.arm)) errors.push(`${where}: arm must be with-only or both`);
      if (data.type === 'regex' && !data.pattern) errors.push(`${where}: regex needs pattern`);
      if (data.type === 'regex' && data.pattern) { try { new RegExp(data.pattern); } catch (e) { errors.push(`${where}: bad pattern: ${e.message}`); } }
      if (data.type === 'tool_used' && !data.tool) errors.push(`${where}: tool_used needs tool`);
      if (data.type === 'tool_used' && data.input_match) { try { new RegExp(data.input_match); } catch (e) { errors.push(`${where}: bad input_match: ${e.message}`); } }
      if (data.type === 'tool_order' && (!data.before || !data.after)) errors.push(`${where}: tool_order needs before and after`);
      if (data.type === 'file_exists' && !data.path) errors.push(`${where}: file_exists needs path`);
      if ((data.type === 'llm' || data.type === 'baseline') && !data.criteria && !body.trim()) errors.push(`${where}: ${data.type} needs criteria (frontmatter or body)`);
    }
  }
  return { errors, cases: caseDirs.length };
}

// `plugins:` from prompt.md frontmatter (which wins) or case.yaml, as an inline list.
function loadedPlugins(dir, prompt, caseYaml) {
  for (const f of [prompt, caseYaml]) {
    if (!existsSync(f)) continue;
    const m = /^plugins:\s*\[(.*)\]\s*$/m.exec(readFileSync(f, 'utf8'));
    if (m) return m[1].split(',').map((x) => x.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
  }
  return [];
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const root = resolve(i > 0 ? process.argv[i + 1] : process.cwd());
  let errors = [];
  let cases = 0;
  for (const p of readdirSync(join(root, 'plugins'))) {
    const dir = join(root, 'plugins', p, 'evals');
    if (!existsSync(dir)) continue;
    const manifest = JSON.parse(readFileSync(join(root, 'plugins', p, '.claude-plugin', 'plugin.json'), 'utf8'));
    const deps = (manifest.dependencies ?? []).map((d) => (typeof d === 'string' ? d : d.name));
    const r = checkSuite(dir, deps);
    errors = errors.concat(r.errors.map((e) => `plugins/${p}/evals/${e}`));
    cases += r.cases;
  }
  for (const e of errors) console.error(`  ✗ ${e}`);
  console.log(errors.length ? `evals: ${errors.length} problem(s)` : `evals: ok (${cases} cases)`);
  process.exit(errors.length ? 1 : 0);
}
