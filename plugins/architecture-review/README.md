# architecture-review

A read-only **architecture-reviewer** agent for Claude Code. It grades a diff against layering and
boundary rules — onion rings and dependency direction, ports and adapters, core/engine purity,
frontend import direction — and reports findings graded `CRITICAL` / `WARNING` / `SUGGESTION`, each
with the changed `file:line`, the quoted import or statement, the rule source and the
architecture-check output where the rule is machine-enforced. It grades **layering, not
correctness**, and it never fixes anything.

## Components

| Component | Type | Invocation | What it does |
|---|---|---|---|
| `architecture-reviewer` | agent | `architecture-review:architecture-reviewer` (dispatched by Claude, or "use the architecture-reviewer agent") | Reviews changed lines against `engineering-paved-path` skills plus repo-local architecture docs and boundary-tool configs; read-only (`Write` and `Edit` disallowed) |

## Install

```
/plugin marketplace add Pereplut/dev-digest-ai-marketplace
/plugin install architecture-review@dev-digest-ai-marketplace
```

Depends on `engineering-paved-path@^1.0.0`, which is installed with it.

## Use

```
Use the architecture-review:architecture-reviewer agent on this branch against origin/main.
```

Run it after an implementation pass, or whenever a change adds a module, an adapter, a repository or
a third-party SDK. It can run in parallel with a correctness review on the same diff; a clean
architecture report says nothing about bugs.

## What it reads from the target repository

- the diff (`git diff <base>...HEAD`, default base = the remote default branch);
- agent instructions (`AGENTS.md` / `CLAUDE.md`, root and package-level), `docs/` and ADRs — for
  project rings, module layout, protected paths and documented deviations;
- boundary-tool configs — `.dependency-cruiser.*`, ESLint import-restriction zones,
  `eslint-plugin-boundaries`, ast-grep rules — and their exclusions (grandfathered code);
- the project's **documented** architecture check command, which it runs if one exists. It never
  invents one; with none documented it says "no architecture check command found";
- `INSIGHTS.md` files, if any, for known tooling limits.

Rule sources it loads with the `Skill` tool: `engineering-paved-path:onion-architecture` (backend),
`engineering-paved-path:react-code-organization` (frontend), and `engineering-paved-path:security`
only when the diff touches a trust boundary. Repository rules override the generic doctrine.

## Severity

The rubric lives in the agent prompt. `CRITICAL` is reserved for dependency-direction breaks,
trust-boundary breaks, contract breaks across a boundary and violations of the project's own
error-level boundary rules. Skill-internal labels (CRITICAL / HIGH / MEDIUM) are not verdicts: a
skill-CRITICAL rule that does not meet the rubric becomes `WARNING`.

## Limitations

- Changed lines only; pre-existing violations are listed separately and never counted.
- Import-graph tools cannot see logic placed in the wrong layer without a forbidden import; those
  findings rest on reading the code and are capped at `WARNING`.
- It is not a merge gate by itself and does not write any gate state.

## Project

Part of [dev-digest-ai-marketplace](https://github.com/Pereplut/dev-digest-ai-marketplace). The
[build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3) covers how the plugins were built, released and
measured.
