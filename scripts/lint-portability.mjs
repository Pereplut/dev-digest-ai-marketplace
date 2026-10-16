#!/usr/bin/env node
// Portability and English-only lint for everything users install (spec 0001 AC-6, AC-7, AC-8).
//
//   node scripts/lint-portability.mjs [--root <dir>]
//
// Scans plugins/** with all rules, and docs/, specs/ and root Markdown with the English-only rule.
// A line may opt out of a rule by containing `portability-allow: <rule>` (use sparingly; reviewers check it).
import { readFileSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, extname } from 'node:path';
import { walk } from './lib/repo.mjs';

const TEXT_EXT = new Set(['.md', '.json', '.py', '.mjs', '.js', '.ts', '.sh', '.yml', '.yaml', '.txt', '.toml']);

export const RULES = [
  { id: 'product-name', re: /dev-?digest(?!-ai-marketplace)/i, msg: 'product name in a public component' },
  { id: 'product-package', re: /@devdigest\//i, msg: 'product package name' },
  { id: 'product-dir', re: /(^|[\s`'"(\[])(server|client|reviewer-core|agent-runner)\/(?!\/)/, msg: 'product directory (use a generic example such as src/ or api/)' },
  { id: 'absolute-path', re: /(\/home\/[a-z_][\w-]*|\/Users\/[A-Za-z][\w-]*|\b[A-Z]:\\\\?[A-Za-z])/, msg: 'absolute or machine-specific path' },
  { id: 'english-only', re: /[Ѐ-ӿ]/, msg: 'non-English (Cyrillic) text', everywhere: true },
  {
    id: 'secret',
    re: /(sk-[A-Za-z0-9_-]{20,}|sk-ant-[A-Za-z0-9_-]{10,}|ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN [A-Z ]*PRIVATE KEY-----|xox[baprs]-[A-Za-z0-9-]{10,})/,
    msg: 'secret-like token',
  },
  { id: 'local-layout', re: /\.claude\/(skills|agents|hooks)\/[a-z]/, msg: 'hardcoded .claude/ layout path (reference the component by its namespaced name, or ${CLAUDE_PLUGIN_ROOT})' },
];

function scanFile(path, root, { pluginDir }) {
  const problems = [];
  const text = readFileSync(path, 'utf8');
  const lines = text.split(/\r?\n/);
  lines.forEach((line, i) => {
    for (const rule of RULES) {
      if (!pluginDir && !rule.everywhere) continue;
      if (line.includes(`portability-allow: ${rule.id}`)) continue;
      // URLs are attribution, not paths the component uses; only the secret rule looks inside them.
      const subject = rule.id === 'secret' ? line : line.replace(/https?:\/\/\S+/g, '<url>');
      if (rule.re.test(subject)) problems.push({ file: relative(root, path), line: i + 1, rule: rule.id, msg: rule.msg, text: line.trim().slice(0, 140) });
    }
    // AC-8: relative Markdown links must stay inside the plugin directory.
    if (pluginDir && extname(path) === '.md') {
      for (const m of line.matchAll(/\]\((\.\.?\/[^)#\s]+)/g)) {
        const target = resolve(dirname(path), m[1]);
        if (!target.startsWith(pluginDir + '/')) {
          problems.push({ file: relative(root, path), line: i + 1, rule: 'escapes-plugin', msg: 'relative link leaves the plugin directory (not shipped on install)', text: m[1] });
        } else if (!existsSync(target)) {
          problems.push({ file: relative(root, path), line: i + 1, rule: 'broken-link', msg: 'relative link target does not exist', text: m[1] });
        }
      }
    }
  });
  return problems;
}

export function lint(root) {
  root = resolve(root);
  const problems = [];
  const pluginsDir = join(root, 'plugins');
  if (existsSync(pluginsDir)) {
    for (const file of walk(pluginsDir)) {
      if (!TEXT_EXT.has(extname(file))) continue;
      const pluginDir = join(pluginsDir, relative(pluginsDir, file).split('/')[0]);
      problems.push(...scanFile(file, root, { pluginDir }));
    }
  }
  const englishOnly = [join(root, 'docs'), join(root, 'specs'), join(root, 'channels'), join(root, '.claude-plugin')]
    .filter(existsSync)
    .flatMap((d) => walk(d))
    .concat(['README.md', 'CONTRIBUTING.md', 'AGENTS.md'].map((f) => join(root, f)).filter(existsSync));
  for (const file of englishOnly) if (TEXT_EXT.has(extname(file))) problems.push(...scanFile(file, root, { pluginDir: null }));
  return problems;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = process.argv.indexOf('--root');
  const root = i > 0 ? process.argv[i + 1] : process.cwd();
  const problems = lint(root);
  for (const p of problems) console.log(`${p.file}:${p.line}  [${p.rule}] ${p.msg}\n    ${p.text}`);
  console.log(problems.length ? `\nportability: ${problems.length} problem(s)` : 'portability: ok');
  process.exit(problems.length ? 1 : 0);
}
