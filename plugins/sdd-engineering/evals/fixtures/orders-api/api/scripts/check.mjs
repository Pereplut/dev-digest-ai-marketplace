// Syntax check for every source file (stands in for a typechecker); --lint also rejects `var`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const files = [];
const walk = (d) => readdirSync(d).forEach((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith('.js') && files.push(join(d, n))));
walk('src');
let bad = 0;
for (const f of files) {
  try { execFileSync(process.execPath, ['--check', f]); } catch { console.error(`syntax: ${f}`); bad++; }
  if (process.argv.includes('--lint') && /\bvar\s/.test(readFileSync(f, 'utf8'))) { console.error(`lint: ${f} uses var`); bad++; }
}
console.log(bad ? `${bad} problem(s)` : `ok (${files.length} files)`);
process.exit(bad ? 1 : 0);
