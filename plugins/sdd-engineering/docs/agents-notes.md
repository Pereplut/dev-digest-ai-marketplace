# Agent notes

Per agent: the judgement calls made when generalizing it, and what it expects from the target
repository. Every agent reads project facts (spec directory, protected paths, verify commands,
user-owned commands, naming, architecture rules) from the target repo's `AGENTS.md` / `CLAUDE.md`
(root and package-level) and the `docs/` they point to, and cites the source in its report. None
invents a verify command: with none documented it reports "no verify command found" and asks.

## spec-creator

- **Write boundary is instruction-only.** No hook ships, so the agent states in its `## Spec
  written` section that the boundary is enforced by instruction, not by a hook. Tools stay `Read,
  Grep, Glob, Write, Edit, Skill, TodoWrite` — no `Bash`, no `Agent`, so it cannot shell or delegate
  past the boundary.
- **Template lives in `sdd-engineering:spec-authoring`** (`references/spec-template.md`). A
  project-defined template in `<spec-dir>/README.md` takes precedence. The course-specific `lesson:`
  field is gone.
- **Checker hand-off** names `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/check_specs.py`, with
  `--spec-root` / `--template` when the spec directory is not `specs/`.
- **No spec directory** → it creates `specs/` with a `README.md` index and files `0001`.
- **Package specs** (`<pkg>/specs/`) only when the repo already uses that convention.
- Expects: optional mockups passed by path; optional routed insights output from the caller (it
  cannot run `insights_for.py`).

## implementation-planner

- Removed the copied do-not-touch list, ring table, naming table, skill-routing table and verify
  table (AC-22). Replaced with: read project facts from instructions; architecture via
  `engineering-paved-path:*`; routing via a project map if present, else by skill descriptions.
- Added hard rule "never invent a command" (AC-11).
- The planner is read-only, so it **returns** the plan; the session (`run-plan`) saves it to
  `.sdd/<spec-id>.plan.md` (AC-19).
- Kept verbatim: `R*` / `S*` / `C*` / `V*` / `P*` id schemes, the four verdicts, `## No spec`
  and override stamp, all report headings, execution-mode section ending in `AskUserQuestion`.
- Reviewer stage names `architecture-review:architecture-reviewer`; the correctness review is
  "for example `/code-review`", not assumed installed.
- Bash guidance generalized (no allowlist measurements); the "avoid write/exec shell forms" rule
  kept.
- Expects: an approved / in-progress spec; documented verify commands.

## implementer

- Kept a short list of **universal defaults** (lockfiles, existing migrations, frozen vendored
  code, data-wiping commands) because they hold in any repo; everything project-specific is
  discovered.
- Product verification traps generalized: green-run rule, typecheck ≠ tests, lint pragma escape,
  "the test runner is not the build" (replaces a product-specific value-import trap).
- Expects: a plan at `.sdd/<spec-id>.plan.md` or in the prompt; user-owned commands declared in the
  instructions (otherwise it treats nothing as user-owned except e2e and slow integration suites it
  can recognize).

## plan-verifier

- Inputs: `.sdd/<spec-id>.plan.md` or a spec path; base ref defaults to the default branch, never
  `HEAD`.
- Clarified that `R*` / `P*` rows are not items (they would double-count the spec's `AC*`).
- Added "ready for review: yes | no" to `## Plan under test` so `run-plan` can gate on one line.
- Re-run commands come from project instructions and are cited; user-owned suites are judged from
  the report's verbatim output.

## test-writer

- `skills:` lists only skills that exist in this marketplace: `engineering-paved-path:security`,
  `engineering-paved-path:onion-architecture`, `sdd-engineering:engineering-insights`. The body
  tells it not to assume preload and to load each with `Skill`, plus any installed / project-local
  testing skills that match the stack.
- Test kind, location and the unit/integration naming split are discovered from instructions and
  neighbouring tests; if neither exists it asks.
- `Agent` limited to consulting `research-tools:researcher`.
- Expects: documented unit-test command; a declared rule for which suites are user-owned.

## doc-writer

- **Dropped spec drafting.** The original could draft a `status: draft` spec for unimplemented
  material; here specs belong to `spec-creator`, so the doc-writer hands that material off instead.
  Its write scope is docs directories only.
- Mermaid guidance is inline and self-contained (diagram-type choice, node limit, label quoting,
  edge labels); an installed Mermaid skill is optional.
- Placement table is a set of defaults, overridden by the project's docs `README.md` / `AGENTS.md`.
- Expects: a `docs/` directory (it creates the `README.md` index if missing).

## Open questions

- Whether `skills:` with cross-plugin names preloads anything is unverified (see the spec's edge
  cases); every agent that relies on a skill loads it with `Skill` explicitly.
- Whether `${CLAUDE_PLUGIN_ROOT}` is substituted inside agent bodies should be confirmed by the
  install test; spec-creator's checker line depends on it being printed resolved.
