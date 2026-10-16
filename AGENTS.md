# dev-digest-ai-marketplace — agent instructions

A Claude Code plugin marketplace. No application code: plugins (Markdown agents and skills, Python and Node scripts),
docs, a static catalog site, and repo tooling.

## Layout
- `.claude-plugin/marketplace.json`: latest channel catalog. `channels/stable/`: stable channel, edited only by `scripts/promote.sh` / `scripts/rollback.sh`.
- `plugins/<name>/`: one plugin each. `version` lives only in its `.claude-plugin/plugin.json`.
- `docs/`: how things are. `specs/`: how things will be. `site/`: Vite + React catalog. `scripts/`: tooling. `test/`: unit tests.

## Verify
| What | Command |
|---|---|
| Everything (validate, consistency, portability lint, unit tests, index) | `./scripts/check.sh` |
| Python unit tests | `python3 -m unittest discover -s test/python` |
| Node unit tests | `node --test "test/js/**/*.test.mjs"` |
| Site | `cd site && npm ci && npm run build` |
| Load plugins locally | `claude --plugin-dir ./plugins/engineering-paved-path --plugin-dir ./plugins/research-tools --plugin-dir ./plugins/architecture-review --plugin-dir ./plugins/sdd-engineering` |

Behaviour evals (`claude plugin eval`) cost tokens. They are user-owned: ask before running them.

## Rules
- Everything under `plugins/` is public and project-agnostic: no product names or paths, no absolute paths, no secrets, English only (`scripts/lint-portability.mjs`).
- Plugin files reference plugin files via `${CLAUDE_PLUGIN_ROOT}` and skill scripts via `${CLAUDE_SKILL_DIR}`. Nothing outside the plugin directory is shipped.
- Cross-plugin references are namespaced (`engineering-paved-path:onion-architecture`).
- Never move or delete a release tag (`<plugin>--v<version>`). Never hand-edit `channels/stable/`.
- Never commit generated files (`site/public/*.json`, `site/dist/`, `evals/results/`).
- Never hand-edit or regenerate lockfiles. They change only through `npm i` in the package that owns them.
