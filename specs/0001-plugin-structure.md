---
id: 0001
title: Plugin structure — sdd-engineering and its dependency plugins
status: in-progress
owner: "@Pereplut"
created: 2026-10-16
---

# 0001 — Plugin structure

## Problem
The Spec-Driven Development (SDD) workflow lives inside one product repository. There it is
tied to that product's directories, package names, scripts and hooks, so no other project can
reuse it. It also ships on the product's release cadence: a UI change in the product can force a
new skill version, and a skill edit can force a product release.

## Goals
- G1. Four installable plugins in one marketplace, each with its own boundary, owner, version,
  README, CHANGELOG and COMPATIBILITY file.
- G2. Version-constrained dependencies so that installing `sdd-engineering` pulls in everything it
  needs.
- G3. Every component is project-agnostic. It reads project facts (spec directory, verify
  commands, protected paths, architecture rules) from the target repository at runtime, instead of
  hardcoding them.
- G4. Technical skills have exactly one source: `engineering-paved-path`.

## Non-goals
- Shipping product-specific instructions, specs, module names or rules.
- Shipping MCP servers or anything that needs network credentials. These are optional
  integrations and are deferred.
- Shipping the pre-push review gate (`pr-self-review`) or the spec-scope write-gate hook.
- Every technical skill "just in case". The paved path stays minimal (see Decisions).

## Plugins and dependency graph

```
sdd-engineering@1.0.0
├── engineering-paved-path@^1.0.0
├── research-tools@^1.0.0
└── architecture-review@^1.0.0
    └── engineering-paved-path@^1.0.0
```

| Plugin | Components | Owner | Consumer scenario |
|---|---|---|---|
| `engineering-paved-path` | skills: `onion-architecture`, `react-code-organization`, `security` | @Pereplut | Any agent or human that needs architecture-placement or security rules |
| `research-tools` | agent: `researcher` | @Pereplut | Read-only discovery in a repo or from upstream docs, with or without SDD |
| `architecture-review` | agent: `architecture-reviewer` | @Pereplut | Layering and boundary review of a diff, standalone or as an SDD review gate |
| `sdd-engineering` | agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, `test-writer`, `doc-writer`; skills: `run-plan`, `workflow-retro`, `engineering-insights`, `spec-authoring`; scripts: `check_specs.py`, `insights_for.py`; evals | @Pereplut | spec, then plan, then implementation, then verification, then review, for a feature in any repo |

Cross-plugin references always use the namespaced form:
`engineering-paved-path:onion-architecture`, `research-tools:researcher`,
`architecture-review:architecture-reviewer`. References inside the same plugin also use the full
name wherever the field expects a plugin-scoped reference.

## Acceptance criteria (EARS)

**Layout and manifests**
- **AC-1** The marketplace shall list exactly four plugins in `.claude-plugin/marketplace.json`, and each entry's `name` shall equal the `name` in that plugin's `.claude-plugin/plugin.json`.
- **AC-2** Each plugin shall set `version` in `plugin.json` only, never in its marketplace entry.
- **AC-3** Each plugin directory shall contain `README.md`, `CHANGELOG.md` and `COMPATIBILITY.md`.
- **AC-4** `sdd-engineering` shall declare `engineering-paved-path`, `research-tools` and `architecture-review` as dependencies using the object form `{ "name", "version": "^1.0.0" }`; `architecture-review` shall declare `engineering-paved-path` the same way.
- **AC-5** When `claude plugin validate --strict` runs on the marketplace root and on each plugin directory, it shall exit 0.

**Portability**
- **AC-6** No file under `plugins/` shall contain a product name, product package name, product directory (`server/`, `client/`, `reviewer-core/`), absolute path (`/home/`, `/Users/`, `C:\`), or secret pattern; `scripts/lint-portability.mjs` shall exit non-zero if one appears.
- **AC-7** All prose, descriptions and frontmatter under `plugins/` and `docs/` shall be English; the portability lint shall reject Cyrillic characters.
- **AC-8** A component shall reference a plugin-level file only through `${CLAUDE_PLUGIN_ROOT}`, and a script inside a skill only through `${CLAUDE_SKILL_DIR}`.
- **AC-9** No plugin shall read a file outside its own directory, except files in the target repository and files of its declared dependencies.
- **AC-10** When an agent needs a project fact (spec directory, verify commands, protected paths, architecture rules), it shall read the fact from the target repository's agent instructions (`AGENTS.md` / `CLAUDE.md` / `docs/`) and record the source in its report.
- **AC-11** If the target repository documents no test or typecheck command, the agent shall report "no verify command found" and ask the session, and shall not invent one.

**Agents and skills**
- **AC-12** Plugin agent frontmatter shall not use `hooks`, `mcpServers` or `permissionMode`.
- **AC-13** `researcher`, `architecture-reviewer`, `implementation-planner` and `plan-verifier` shall disallow `Write` and `Edit`.
- **AC-14** `spec-creator` shall write only under the project's spec directory (default `specs/`) and shall state in its report that this boundary is enforced by instruction, not by a hook.
- **AC-15** `architecture-reviewer` shall take its rules from `engineering-paved-path` skills plus repository-local architecture docs, and shall classify findings as `CRITICAL`, `WARNING` or `SUGGESTION` using the rubric in its own prompt.
- **AC-16** `run-plan` shall run the plan-verifier gate before any reviewer, and shall dispatch `architecture-review:architecture-reviewer` as a reviewer.
- **AC-17** `run-plan` shall run `test-writer` only when it is invoked with `--tests`, and shall run `doc-writer` unless it is invoked with `--no-docs`.
- **AC-18** `run-plan` and `workflow-retro` shall set `disable-model-invocation: true`.
- **AC-19** The SDD workflow shall store specs at `<spec-dir>/NNNN-<name>.md` and plans at `.sdd/<spec-id>.plan.md` in the target repository, and the `sdd-engineering` README shall document both locations.
- **AC-20** `engineering-insights` and `insights_for.py` shall discover `INSIGHTS.md` files by searching the repository, not by using a fixed package list.
- **AC-21** `check_specs.py` shall accept the spec root and template path as arguments, with defaults `specs/` and `specs/README.md`.
- **AC-22** Instructions shall not be duplicated between agent prompts and skills; detail shall live in the skill or its `references/`, and the agent shall point to it.

**Install behaviour**
- **AC-23** When `sdd-engineering` is installed into a repository that has no local SDD components, `claude plugin list --json` shall report all four plugins and no `dependency-unsatisfied` or `dependency-version-unsatisfied` error.
- **AC-24** When an unrelated request (for example "explain this regex") is given in a repository with the plugins installed, no SDD agent shall be dispatched.

## Edge cases
- The target repo has no `specs/` directory: spec-creator creates it, along with a `README.md` index.
- The target repo has no `INSIGHTS.md`: the insights steps are skipped silently.
- A dependency plugin is disabled by the user: Claude Code reports `dependency-unsatisfied`, and the sdd README explains how to fix it.
- A project already has local agents with the same names: plugin agents are namespaced, so the README advises removing the local copies before running evals (otherwise traces are ambiguous).
- `workflow-retro` deep mode reads Claude Code session transcripts (`~/.claude/projects/...`), which are outside both the plugin and the target repository. This is the only sanctioned exception to AC-9. It runs only on explicit opt-in, after showing the user the directory it will read.
- Cross-plugin `skills:` preload in agent frontmatter is undocumented. If it does not preload, agents fall back to an explicit `Skill` call. This is verified empirically and recorded in INSIGHTS.

## Decisions
- D1. `run-plan` is generalized from the product's local `/impl` orchestrator, not taken from the upstream `run-plan`.
- D2. `test-writer`, `doc-writer`, `spec-authoring` and the two scripts ship in `sdd-engineering`.
- D3. The paved path is minimal: `onion-architecture`, `react-code-organization`, `security`.
- D4. No hooks in v1.0.0. Recommended permission rules ship as an opt-in settings snippet in the README, because plugins cannot ship `permissions`.
- D5. Minimum Claude Code is `>=2.1.110` (version-constrained dependencies). Newer features are listed separately in COMPATIBILITY.md.

## Test plan
| ID | How it is tested |
|---|---|
| AC-1 | `scripts/check.sh` manifest-name check |
| AC-2 | `scripts/check.sh` checks for no `version` in marketplace entries |
| AC-3 | `scripts/check.sh` checks required files |
| AC-4 | `scripts/check.sh` dependency check, and `claude plugin list --json` after install |
| AC-5 | CI `validate.yml` |
| AC-6 | `scripts/lint-portability.mjs`, plus a unit test with a planted path |
| AC-7 | `scripts/lint-portability.mjs`, plus a unit test with planted Cyrillic text |
| AC-8 | Portability lint rule (relative plugin paths outside `${...}` are rejected) |
| AC-9 | Install into a foreign repo (Phase 7) |
| AC-10 | Behavior evals `planner-reads-project-facts` and `planner-refuses-draft-spec` |
| AC-11 | Behavior eval `no-verify-command` |
| AC-12 | `scripts/check.sh` frontmatter check |
| AC-13 | `scripts/check.sh` frontmatter check |
| AC-14 | Behavior eval `spec-creator-writes-spec-only` |
| AC-15 | Behavior eval `arch-review-severity` |
| AC-16 | Behavior eval `run-plan-gate-order` |
| AC-17 | Behavior evals `run-plan-optional-stages` (`--tests --no-docs`) and `run-plan-gate-order` (defaults) |
| AC-18 | `scripts/check.sh` frontmatter check, and negative eval `retro-not-auto` |
| AC-19 | Behavior eval `spec-and-plan-locations` |
| AC-20 | Unit test for `insights_for.py` discovery |
| AC-21 | Unit test for `check_specs.py` arguments |
| AC-22 | Cost-baseline optimization review (docs/COST-BASELINE.md) |
| AC-23 | Manual install in a foreign repo (Phase 7) |
| AC-24 | Negative eval `unrelated-request` |

## Phases
| Phase | Date | Notes |
|---|---|---|
| Initiation | 2026-10-16 | Lab notes reviewed; three research runs (local inventory, upstream branches, official plugin docs) |
| Planning | 2026-10-16 | Spec written; approved by owner 2026-10-16 |
| Implementation | 2026-10-16 | Extraction done: 4 plugins (8 agents, 7 skills, 3 scripts); repo docs and tooling; check.sh green; local --plugin-dir load verified. Next: site, CI, evals |
| Implementation | 2026-10-16 | Catalog site and CI pushed; validate (incl. Playwright 15/15) green on GitHub. Eval suite written: 10 cases in `plugins/sdd-engineering/evals/`, linted by `scripts/check-evals.mjs`; not yet run (costs tokens) |
| Validation | 2026-10-16 | First eval runs (negative tag, 1 run). The first was invalid: dependencies were not loaded, so no plugin ran. Fixed with `plugins:` per case, run from the marketplace root, and a check-evals rule. Then 4/4 for $0.66 (docs/COST-BASELINE.md, Runs). |
| Validation | 2026-10-16 | Baseline, 8 of 10 cases, N=3, both arms, `claude-opus-5-5`: 0.93 with the plugin vs 0.47 without, 0 critical failures. Three graders fixed first, all recorded. The 2 heavy run-plan cases need Bash; the local sandbox refuses (Docker symlink), so they go to CI. Spec-creator omits the boundary line in 1 of 3 runs (AC-14), a 1.1.0 candidate |
