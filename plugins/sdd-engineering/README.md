# sdd-engineering

**Spec-Driven Development for Claude Code.** A feature goes from an idea to reviewed, documented
code through a fixed chain of agents. Each agent has one job and a narrow set of tools, and every
handoff is a file you can read: the spec, the plan, the implementation report, the verification
matrix and the review findings.

```
/plugin marketplace add Pereplut/dev-digest-ai-marketplace
/plugin install sdd-engineering@dev-digest-ai-marketplace
/reload-plugins
```

Installing it also installs its dependencies: `engineering-paved-path`, `research-tools` and
`architecture-review`.

## Components

| Component | Kind | Invoke as | Tools | Job |
|---|---|---|---|---|
| `spec-creator` | agent | `@agent-sdd-engineering:spec-creator` | Read, Grep, Glob, Write, Edit, Skill (no Bash) | Writes the spec: problem, goals, EARS acceptance criteria, edge cases, test plan. Never writes code or plans; never approves |
| `implementation-planner` | agent | `@agent-sdd-engineering:implementation-planner` | read-only + Bash | Turns an approved spec into a Development Plan: steps, files, tests, verification, execution mode |
| `implementer` | agent | dispatched by `run-plan` | Read, Write, Edit, Bash, Skill | Executes the plan, writes code and tests, runs the project's verify commands |
| `plan-verifier` | agent | dispatched by `run-plan` | read-only + Bash | Completeness gate: every step, constraint, verification and AC gets a status and evidence; unplanned hunks are reported |
| `test-writer` | agent | `run-plan --tests` | Read, Write, Edit, Bash, Skill | Writes tests only, for coverage the implementer did not own |
| `doc-writer` | agent | `run-plan` (unless `--no-docs`) | Read, Write, Edit, Bash, Skill | Documents what shipped, under the project's docs directory |
| `run-plan` | skill (manual) | `/sdd-engineering:run-plan <spec>` | — | Orchestrates implementation, gate, review, fix loop and completion |
| `spec-authoring` | skill | loaded by `spec-creator` | — | EARS patterns, testability rules, edge-case checklist, test-plan rules, spec template |
| `engineering-insights` | skill | auto / `/sdd-engineering:engineering-insights` | — | Records non-obvious findings in the right `INSIGHTS.md`, dated and with `file:line` evidence |
| `workflow-retro` | skill (manual) | `/sdd-engineering:workflow-retro` | — | Retrospective over a run's agent journal; writes proposals to `WORKFLOW-RETRO.md`, never edits agents |

It also uses components from its dependencies:
- `research-tools:researcher`, for facts the spec must not guess;
- `architecture-review:architecture-reviewer`, as the layering reviewer;
- `engineering-paved-path:onion-architecture`, `:react-code-organization` and `:security`, for
  architecture and security rules.

## How it works together

```
 idea
  │
  ▼
 research-tools:researcher ──── settle facts the spec would otherwise guess (optional, repeatable)
  │
  ▼
 sdd-engineering:spec-creator ── writes <spec-dir>/NNNN-<name>.md   (status: draft)
  │
  ▼
 YOU review and set status: approved ◄── only a human approves a spec
  │
  ▼
 sdd-engineering:implementation-planner ── returns the Development Plan
  │                                        (session saves it to .sdd/<spec-id>.plan.md)
  ▼
 /sdd-engineering:run-plan <spec>
  ├─ Stage 0  intake: project facts, spec status, check_specs.py, plan file, status → in-progress, commit
  ├─ Stage 1  sdd-engineering:implementer (one per package bucket, or one)        → commit
  ├─ Stage 2  sdd-engineering:plan-verifier  ── completeness gate; Missing/Contradicted → back to implementer
  ├─ Stage 3  in parallel: architecture-review:architecture-reviewer
  │                        /code-review (correctness)
  │                        sdd-engineering:test-writer          (only with --tests)
  ├─ Stage 4  fix loop (capped rounds), every reviewer re-runs each round          → commit per round
  └─ Stage 5  sdd-engineering:doc-writer (unless --no-docs), engineering-insights wrap-up,
              spec → done once plan-verifier is clean; hand user-owned commands to you
  │
  ▼
 /sdd-engineering:workflow-retro   (manual, any time later)
```

**Why plan-verifier goes first:** it is read-only, it is the cheapest, and it is the only check
that can see a planned step that produced no diff. Running the reviewers against a half-built
change wastes them.

## A short walkthrough

```
> @agent-research-tools:researcher How does this repo validate request bodies today?
> @agent-sdd-engineering:spec-creator Spec a CSV export for the orders list. Mockup: design/orders-export.png
    → specs/0007-orders-csv-export.md (draft) + a Spec Report with open questions
> (answer the questions, edit the spec, set status: approved)
> @agent-sdd-engineering:implementation-planner Plan specs/0007-orders-csv-export.md
    → Development Plan; choose an execution mode when asked
> /sdd-engineering:run-plan 0007 --tests
    → implementation, gate, reviews, fixes, docs; ends with the commands only you should run
> /sdd-engineering:workflow-retro
```

## Files the workflow writes in your repository

| Path | Written by | Commit it? |
|---|---|---|
| `<spec-dir>/NNNN-<name>.md` (default `specs/`; `<pkg>/specs/` if your repo already uses that) | `spec-creator` | yes |
| `<spec-dir>/README.md` index row (and the index itself if missing) | `spec-creator` | yes |
| `.sdd/<spec-id>.plan.md`, where `<spec-id>` is the spec path with `/` → `-` and `.md` dropped (`specs/0007-x.md` → `.sdd/specs-0007-x.plan.md`) | `run-plan` (saves the planner's reply verbatim) | no, add `.sdd/` to `.gitignore` |
| `.sdd/retro/<session-id>.runs.jsonl`: one row per agent run (tokens, tools, ms, outcome) | `run-plan` | no |
| `INSIGHTS.md` files (root or per module) | `engineering-insights` | yes |
| `docs/**` | `doc-writer` | yes |
| `WORKFLOW-RETRO.md` | `workflow-retro` | your choice |

## What it reads from your repository

Nothing about your project is hardcoded. The agents look up these facts and cite where they found
each one:

| Fact | Where it is looked up | If missing |
|---|---|---|
| Verify commands (typecheck, lint, tests) | `AGENTS.md` / `CLAUDE.md` (root and package level), package manifests they point to | **"no verify command found"**, then it asks you; it never invents one |
| User-owned commands (slow integration suites, e2e, pre-push review gates) | same | none are assumed |
| Protected paths (migrations, lockfiles, vendored code) | same | universal defaults: never edit lockfiles or existing migrations |
| Spec directory and template | `specs/README.md` template block | bundled template in `spec-authoring/references/spec-template.md` |
| Architecture rules | `docs/` / ADRs, boundary-tool configs, plus `engineering-paved-path` skills | paved-path doctrine only |
| Skill routing (which technical skill applies to which path) | a project routing map, if you have one | match touched files to installed skill descriptions |
| Insights | `**/INSIGHTS.md` | skipped silently |

A minimal `AGENTS.md` that makes the workflow precise:

```markdown
## Verify
| Package | Typecheck | Lint | Tests |
|---|---|---|---|
| api/ | npm run typecheck | npm run lint | npm test |

User-owned (agents must not run): `npm run test:integration`, `./scripts/e2e.sh`

## Do not touch
- `api/db/migrations/**`: generate new migrations, never edit existing ones
- lockfiles
```

## Bundled scripts

```
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/check_specs.py [--root .] [--spec-root specs] [--template specs/README.md] [spec ...]
python3 ${CLAUDE_PLUGIN_ROOT}/scripts/insights_for.py [--root .] <paths...> | --base <ref>
python3 ${CLAUDE_SKILL_DIR}/scripts/analyze_journals.py   # inside workflow-retro
```

`${CLAUDE_PLUGIN_ROOT}` is substituted inside agent and skill text but is **not** set in your shell.
To run a script by hand, use the path shown by `claude plugin list --json`.

## Recommended settings (optional)

Plugins cannot ship permission rules. If you want the read-only agents to be read-only in the shell
too, add rules like these to your project's `.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "Read(~/.claude/plugins/cache/dev-digest-ai-marketplace/**)",
      "Bash(git status:*)", "Bash(git log:*)", "Bash(git show:*)", "Bash(git diff:*)", "Bash(ls:*)"
    ],
    "deny": ["Read(./.env*)", "Read(~/.ssh/**)", "Bash(git push:*)"]
  }
}
```

The `Read` rule lets the agents open the plugin's own reference files: the spec template and
`run-plan`'s `references/`. These sit in the plugin cache, outside your project, so without the rule
Claude Code asks for each read, and a headless (`claude -p`) session refuses it. The skills cope with
a refusal. `spec-authoring` carries the template's headings inline. With the rule, nothing is skipped.
The rule covers the latest channel. The stable channel caches under
`~/.claude/plugins/cache/dev-digest-ai-marketplace-stable/`, so add that path too if you use it.

## Limitations

- **The spec-creator write boundary is an instruction, not a hook.** It is told to write only under
  the spec directory, and it has no `Bash`. If you need a hard guarantee, add a project
  `PreToolUse` hook keyed on `agent_type == "sdd-engineering:spec-creator"`. See
  [SECURITY](https://github.com/Pereplut/dev-digest-ai-marketplace/blob/main/docs/SECURITY.md).
- `run-plan` and `workflow-retro` are manual-only (`disable-model-invocation: true`).
- `run-plan` commits locally but never pushes or opens a PR.
- **Local copies shadow the plugin.** If your repo already has local agents named `spec-creator`
  and so on, remove them before using the plugin. Otherwise traces will not show which one ran.
- `workflow-retro` deep mode reads Claude Code transcripts under `~/.claude/projects/`, only after
  you opt in.

## Evals

`evals/` holds the plugin's behaviour suite for `claude plugin eval`: 11 cases over a small fixture
repository, including negative cases (an unrelated request must not start the workflow; the retro
never runs on its own). It is for maintainers. Using the plugin never runs it. How to run it and
the measured costs are in
[COST-BASELINE](https://github.com/Pereplut/dev-digest-ai-marketplace/blob/main/docs/COST-BASELINE.md).

## Design notes

[docs/agents-notes.md](docs/agents-notes.md) records the judgement calls made when generalizing
each agent, and what each one expects from the target repository.

## Project

Part of [dev-digest-ai-marketplace](https://github.com/Pereplut/dev-digest-ai-marketplace). The
[build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3) covers how the plugins were built, released and
measured.
