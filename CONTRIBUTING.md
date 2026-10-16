# Contributing

This guide is meant to let you prepare a pull request without asking anyone where files go or
what to run.

## 1. Plugin layout

```
plugins/<name>/
├── .claude-plugin/plugin.json   # the manifest — the single source of truth for name, version, dependencies
├── agents/<agent>.md            # optional; one file per agent
├── skills/<skill>/SKILL.md      # optional; one directory per skill, plus references/, scripts/, examples
├── scripts/                     # optional; plugin-level scripts, referenced as ${CLAUDE_PLUGIN_ROOT}/scripts/...
├── evals/                       # optional; `claude plugin eval` cases (prompt.md + graders/)
├── README.md                    # required: what it is, components, install, usage, what it reads from the target repo
├── CHANGELOG.md                 # required: Keep a Changelog, one section per released version
└── COMPATIBILITY.md             # required: minimum Claude Code version and any newer feature relied on
```

Everything a plugin needs must be inside its own directory. Files outside it are **not** copied
into the plugin cache on install, so `../shared/...` breaks for users.

## 2. Manifest fields

`plugin.json` must set `name` (kebab-case, equal to the marketplace entry name), `version`
(SemVer), `description`, `author`, `homepage`, `repository`, `license` and `keywords`. Set
`dependencies` when the plugin uses another plugin's agents or skills.

- Put `version` **only** in `plugin.json`, never in the marketplace entry.
- The marketplace entry carries only `name`, `source`, `description`, `category` and `tags`.

## 3. Dependency rules

- Declare dependencies in object form: `{ "name": "engineering-paved-path", "version": "^1.0.0" }`.
- Reference another plugin's component by its namespaced name, for example
  `engineering-paved-path:onion-architecture` or `architecture-review:architecture-reviewer`.
- No cycles. Technical skills live only in `engineering-paved-path`; never copy a skill into a
  consumer plugin.
- A dependency must be released (tagged) before any plugin that depends on it.

## 4. Portability rules

Components are public and must work in any repository.

- No product names, product directories, absolute paths, usernames or secrets.
- English only.
- Project facts (verify commands, protected paths, spec directory, architecture rules) are read
  from the target repository's `AGENTS.md` / `CLAUDE.md` / `docs/` at runtime, never hardcoded.
- Use `${CLAUDE_PLUGIN_ROOT}` for plugin files and `${CLAUDE_SKILL_DIR}` for skill-local scripts.
- Plugin agent frontmatter may not use `hooks`, `mcpServers` or `permissionMode`; Claude Code
  ignores them in plugins.

`scripts/lint-portability.mjs` enforces the mechanical part. See
[docs/PLUGIN-GUIDELINES.md](docs/PLUGIN-GUIDELINES.md) for the editorial rules.

## 5. Checks

```
./scripts/check.sh                 # validate (strict) + manifest consistency + portability lint + unit tests + index build
claude --plugin-dir ./plugins/<name> [--plugin-dir ./plugins/<dep> ...]   # load locally and try it
claude plugin eval --eval-dir plugins/<name>/evals                      # behaviour evals (costs tokens)
```

## 6. Pull request checklist

- [ ] `./scripts/check.sh` is green.
- [ ] `version` bumped in `plugin.json` for any user-visible change (SemVer, see [docs/RELEASES.md](docs/RELEASES.md)).
- [ ] `CHANGELOG.md` has a section for that version.
- [ ] `README.md` and `COMPATIBILITY.md` are updated if behaviour or requirements changed.
- [ ] Behaviour change: an eval case was added or updated, and its result is in the PR description.
- [ ] No generated files committed (`site/public/*.json`, `site/dist/`, `evals/results/`).
- [ ] CODEOWNERS for every touched plugin are requested as reviewers.
