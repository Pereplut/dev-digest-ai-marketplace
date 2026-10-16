import { defineConfig } from 'vitest/config';
import type { Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Inject the no-JS plugin list written by scripts/build-index.mjs into #root (SITE-SPEC AC-12).
// React replaces it on mount, so visitors with JavaScript never see it.
function staticCatalog(): Plugin {
  const file = fileURLToPath(new URL('./public/catalog.html', import.meta.url));
  return {
    name: 'static-catalog',
    transformIndexHtml(html) {
      if (!existsSync(file)) throw new Error('public/catalog.html missing: run `npm run build:index` first');
      return html.replace('<!--static-catalog-->', readFileSync(file, 'utf8'));
    },
  };
}

export default defineConfig({
  // Relative base: the same build works at https://<owner>.github.io/<repo>/ and from a local preview.
  base: './',
  plugins: [react(), staticCatalog()],
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
