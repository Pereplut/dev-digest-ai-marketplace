# Compatibility

| Requirement | Value |
|---|---|
| Claude Code | `>=2.1.110` |
| Tested on | Claude Code 2.1.301 |
| Python | 3.9+ (stdlib only) for `scripts/check_specs.py`, `scripts/insights_for.py`, `workflow-retro/scripts/analyze_journals.py` |
| git | any recent version (plan-verifier and run-plan read diffs; `insights_for.py --base`) |

The minimum is set by version-constrained plugin dependencies.

## Dependencies

| Plugin | Range |
|---|---|
| `engineering-paved-path` | `^1.0.0` |
| `research-tools` | `^1.0.0` |
| `architecture-review` | `^1.0.0` |

## Features relied on

- Version-constrained plugin dependencies, in the object form `{ "name", "version" }`. The string
  form loses the range.
- `${CLAUDE_PLUGIN_ROOT}` substitution in agent and skill Markdown bodies, for the bundled scripts.
- `${CLAUDE_SKILL_DIR}` substitution in skill bodies, for `workflow-retro/scripts/`.
- `disable-model-invocation: true` on `run-plan` and `workflow-retro`, which makes them manual-only.
- Dispatching plugin agents by namespaced `subagent_type` (`sdd-engineering:implementer`,
  `architecture-review:architecture-reviewer`).
- `claude plugin eval` (Claude Code 2.1.269+) for the behaviour evals in `evals/`. This is a
  maintainer tool only; users do not need it.

## Target repository expectations

None are required. When present, the following are used:
- `AGENTS.md` / `CLAUDE.md` with verify commands and protected paths
- a `specs/` directory with a template in `specs/README.md`
- `INSIGHTS.md` files
- `docs/`
