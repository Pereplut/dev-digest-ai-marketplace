# Catalog site

The static catalog published at https://pereplut.github.io/dev-digest-ai-marketplace/. The
requirements are in [docs/SITE-SPEC.md](../docs/SITE-SPEC.md).

## How it works

1. `scripts/build-index.mjs` reads the marketplace, every plugin manifest, README, CHANGELOG,
   COMPATIBILITY and component file, and writes `public/` (`index.json`, `search.json`,
   `releases.json`, `stats.json`, `bodies/`, `feed.xml`, `catalog.html`). It fails when a
   marketplace entry and its manifest disagree.
2. Vite builds the React app. A small plugin in `vite.config.ts` injects `catalog.html` into
   `#root`, so the page lists every plugin even without JavaScript; React replaces it on mount.
3. The app runs entirely in the browser: hash routes (`src/lib/router.ts`), MiniSearch over
   `search.json` (`src/lib/search.ts`), Markdown through marked and then DOMPurify
   (`src/lib/markdown.ts`). Every copy-ready command comes from `src/lib/commands.ts`.

Nothing in `public/` or `dist/` is committed. The `pages` workflow rebuilds on every push to
`main` that touches plugins, the marketplace, channels, scripts or the site.

## Commands

```
npm ci
npm run dev        # build the index, then the dev server
npm test           # vitest unit tests
npm run build      # index + typecheck + production bundle in dist/
npm run preview    # serve dist/ on :4173
npm run test:e2e   # Playwright smoke tests against the preview (needs `npx playwright install chromium`)
```

## Token estimates

`stats.json` estimates tokens as characters / 4. The site shows them in three parts:
- **description**: what every session pays for discovery;
- **body**: what loads when a skill or agent runs;
- **references**: supporting files, read only when the body asks for them.

Manual-only skills (`disable-model-invocation: true`) are not listed to the model, so their
discovery cost is 0.
