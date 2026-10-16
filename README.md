# dev-digest-ai-marketplace

A Claude Code plugin marketplace for **Spec-Driven Development (SDD)**. A feature moves through
spec, plan, implementation, a completeness gate and independent review. Each step has its own
agent, and every handoff produces a written artefact.

Catalog: **https://pereplut.github.io/dev-digest-ai-marketplace/**

Build report (what was built, release rehearsal, eval results):
[claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3).
The figures come from [docs/COST-BASELINE.md](docs/COST-BASELINE.md) and [docs/RELEASES.md](docs/RELEASES.md).

## Plugins

| Plugin | What you get | Depends on |
|---|---|---|
| [`sdd-engineering`](plugins/sdd-engineering/) | Agents `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, `test-writer`, `doc-writer`; skills `run-plan`, `workflow-retro`, `engineering-insights`, `spec-authoring` | the three below |
| [`architecture-review`](plugins/architecture-review/) | Agent `architecture-reviewer`: read-only layering review | `engineering-paved-path` |
| [`research-tools`](plugins/research-tools/) | Agent `researcher`: read-only repository and upstream research | — |
| [`engineering-paved-path`](plugins/engineering-paved-path/) | Skills `onion-architecture`, `react-code-organization`, `security` | — |

```
sdd-engineering
├── engineering-paved-path
├── research-tools
└── architecture-review
    └── engineering-paved-path
```

## Install

Inside Claude Code:

```
/plugin marketplace add Pereplut/dev-digest-ai-marketplace
/plugin install sdd-engineering@dev-digest-ai-marketplace
/reload-plugins
```

Or from a shell, for a whole team, committing the result to `.claude/settings.json`:

```
claude plugin marketplace add Pereplut/dev-digest-ai-marketplace --scope project
claude plugin install sdd-engineering@dev-digest-ai-marketplace --scope project
```

Dependencies install automatically. Run `claude plugin list --json` to check that they resolved.
Requires Claude Code **>= 2.1.110** (see each plugin's `COMPATIBILITY.md`).

**Stable channel** (pinned to the last verified release tags; see [docs/RELEASES.md](docs/RELEASES.md)):

```
claude plugin marketplace add https://raw.githubusercontent.com/Pereplut/dev-digest-ai-marketplace/main/channels/stable/.claude-plugin/marketplace.json
claude plugin install sdd-engineering@dev-digest-ai-marketplace-stable
```

## Repository layout

```
.claude-plugin/marketplace.json   catalog (latest channel, relative sources)
channels/stable/                  stable channel, entries pinned to release tags
plugins/<name>/                   one directory per plugin: .claude-plugin/plugin.json, agents/, skills/, README, CHANGELOG, COMPATIBILITY
docs/                             guidelines, security, releases, site spec, cost baseline
specs/                            planned work (how things will be)
scripts/                          check, portability lint, index build, release, rollback
site/                             static catalog (Vite + React), deployed to GitHub Pages
test/                             unit tests for scripts
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `./scripts/check.sh` before every pull request.

## License

MIT, see [LICENSE](LICENSE). Vendored skills keep the attribution in their own README.
