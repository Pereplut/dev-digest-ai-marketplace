---
id: SITE
title: Static marketplace catalog on GitHub Pages
status: approved
owner: "@Pereplut"
created: 2026-10-16
---

# Site spec — marketplace catalog

## Problem
Installing stays a CLI action (`/plugin install`). Discovery does not: users need a way to find a
plugin, skill or agent by what it does, read its documentation, see its dependencies and copy the
right command. GitHub Pages serves static files only, so there is no backend, no database and no
server-side search.

## Goals
- Keyword search across every artifact in the repository (plugins, skills, agents). Results show as cards.
- Detail pages that match the manifests exactly (version, dependencies, components).
- Copy-ready commands for installing, updating, team setup and rollback.
- Everything is computed at build time from the repository; nothing is computed at runtime.

## Non-goals
Ratings, comments, download counters, accounts, analytics, server-side search, and any write
operation.

## Architecture
- `scripts/build-index.mjs` reads `.claude-plugin/marketplace.json`, every
  `plugins/*/.claude-plugin/plugin.json`, each plugin's `README.md`, `CHANGELOG.md` and
  `COMPATIBILITY.md`, and every `skills/*/SKILL.md` and `agents/*.md` (frontmatter and body). It
  writes the following to `site/public/`:
  - `index.json`: plugins and artifacts (id, type, plugin, name, description, keywords, version, deps, tools, model, bodyPath)
  - `releases.json`: CHANGELOG sections parsed into `{plugin, version, date, notes}`
  - `stats.json`: per-artifact bytes and estimated tokens, plus per-plugin totals
  - `bodies/<id>.md`: raw Markdown bodies, loaded lazily
  - `feed.xml`: an Atom feed of releases
- `site/` is built with Vite, React and TypeScript. It uses hash routing, MiniSearch for search,
  and marked followed by DOMPurify for Markdown.
- Generated `site/public/*.json`, `bodies/`, `feed.xml` and `site/dist/` are never committed.

## Routes
| Route | Content |
|---|---|
| `#/` | Hero, search box, plugin cards, "What's new" teaser |
| `#/search?q=&type=&tag=` | Result cards (type badge, plugin, description, match highlight), type and tag filters, deep-linkable |
| `#/plugin/<name>` | Version, owner, compatibility, dependency tree, components list, rendered README, Copy install |
| `#/artifact/<plugin>:<name>` | Rendered SKILL.md or agent prompt; tools, model, invocation (`/plugin:skill` or `@agent-plugin:name`); "used by" back-links |
| `#/graph` | Dependency graph of all plugins (SVG); click a node to open the plugin page |
| `#/whats-new` | Releases from `releases.json`, newest first; link to `feed.xml` |
| `#/getting-started` | Commands for marketplace add, install, update, reload and rollback |
| `#/team-setup` | Snippet builder: pick plugins, then copy a `.claude/settings.json` block |
| `#/compatibility` | Matrix of plugin × version × minimum Claude Code version |

## Acceptance criteria (EARS)
- **AC-1** When a user types a query, the site shall return cards for every plugin, skill and agent whose name, description, keywords, README or body matches, ranked by MiniSearch score, with name and description weighted highest.
- **AC-2** When a query matches a skill nested inside a plugin, the card shall show the skill and its parent plugin.
- **AC-3** When a query matches nothing, the site shall show an empty state that suggests browsing all plugins.
- **AC-4** The plugin page shall show the version and dependencies exactly as declared in that plugin's `plugin.json`.
- **AC-5** When the user clicks **Copy install**, the site shall copy `/plugin install <name>@dev-digest-ai-marketplace` to the clipboard. While the **stable** channel is selected, the marketplace name in the copied command shall be `dev-digest-ai-marketplace-stable`.
- **AC-6** The site shall render every piece of Markdown through marked followed by DOMPurify, and no raw HTML from the repository shall reach the DOM unsanitized.
- **AC-7** When the user selects plugins in `#/team-setup`, the site shall produce valid JSON containing `extraKnownMarketplaces.dev-digest-ai-marketplace` (github source) and an `enabledPlugins` entry `"<name>@dev-digest-ai-marketplace": true` for each selected plugin and its transitive dependencies.
- **AC-8** `#/graph` shall draw one node per plugin and one edge per declared dependency.
- **AC-9** `#/whats-new` shall list every CHANGELOG section with a version heading, and `feed.xml` shall validate as Atom 1.0.
- **AC-10** `#/compatibility` shall show, for each plugin version, the minimum Claude Code version parsed from COMPATIBILITY.md.
- **AC-11** Artifact cards and pages shall show the estimated token size from `stats.json`.
- **AC-12** Without JavaScript, `index.html` shall still list every plugin with its description and install command.
- **AC-13** If `build-index.mjs` finds a marketplace entry whose name does not match its manifest, or a dependency that is not in the marketplace, it shall exit non-zero.
- **AC-14** The pages workflow shall rebuild the index and site on every push to `main` that touches `plugins/**`, `.claude-plugin/**`, `site/**` or `scripts/**`, and shall deploy `site/dist`.
- **AC-15** The site shall work at phone width (≥ 360 px) with no horizontal scroll.

## Untrusted input
README, CHANGELOG and component bodies are repository content written by contributors. They are
treated as untrusted HTML (AC-6). Links are rendered with `rel="noopener noreferrer"`. No
`dangerouslySetInnerHTML` is used without DOMPurify.

## Test plan
| ID | How it is tested |
|---|---|
| AC-1 | Unit test of the search adapter on a fixture index |
| AC-2 | Playwright: search "onion" returns the `onion-architecture` card with plugin `engineering-paved-path` |
| AC-3 | Playwright: a nonsense query shows the empty state |
| AC-4 | Unit test: build-index output equals the manifest for each plugin |
| AC-5 | Playwright: clipboard contents on both channels |
| AC-6 | Unit test: a `<script>` / `onerror` fixture is stripped |
| AC-7 | Unit test of the snippet builder (transitive dependencies included) |
| AC-8 | Unit test of graph data (node and edge counts) |
| AC-9 | Unit test of the changelog parser; Atom validation in CI |
| AC-10 | Unit test of the COMPATIBILITY parser |
| AC-11 | Unit test of the stats builder |
| AC-12 | CI: `curl` the built `index.html` and grep each plugin name |
| AC-13 | Unit test: fixture marketplace with a mismatch makes the build exit 1 |
| AC-14 | Review of `pages.yml` path filters |
| AC-15 | Playwright at a 360 px viewport |
