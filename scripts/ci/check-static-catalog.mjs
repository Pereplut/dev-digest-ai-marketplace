#!/usr/bin/env node
// CI (SITE-SPEC AC-12): the built index.html lists every plugin and its install command, and links the build report, without JavaScript.
//   node scripts/ci/check-static-catalog.mjs site/dist/index.html
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const html = readFileSync(process.argv[2], 'utf8');
const mp = JSON.parse(readFileSync(fileURLToPath(new URL('../../.claude-plugin/marketplace.json', import.meta.url)), 'utf8'));
const missing = mp.plugins.filter((p) => !html.includes(`/plugin install ${p.name}@${mp.name}`)).map((p) => p.name);
if (missing.length) {
  console.error(`static catalog: missing ${missing.join(', ')}`);
  process.exit(1);
}
if (!/<a href="https:\/\/claude\.ai\/artifact\/[^"]+">Build report<\/a>/.test(html)) {
  console.error('static catalog: no Build report link');
  process.exit(1);
}
console.log(`static catalog: all ${mp.plugins.length} plugins listed, build report linked`);
