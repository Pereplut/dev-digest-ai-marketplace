---
name: spec-authoring
description: >-
  How to write a requirement a tester could fail: acceptance criteria in EARS form, the edge-case
  checklist, input provenance tags, untrusted-input obligations, reading what a mockup leaves out,
  and the test-plan rules check_specs.py enforces. Use when writing or amending a spec, auditing or
  restating someone else's acceptance criteria, deciding whether a criterion is testable, or tracing
  plan steps back to criteria. Trigger terms: spec, specification, acceptance criteria, EARS,
  requirement, user story, test plan, edge cases, provenance, untrusted input, shall,
  WHEN/WHILE/IF/WHERE.
---

# Spec authoring

The method for writing requirements. The **shape** of a spec file (which sections, where it lives,
the index row) is defined once in a template and enforced by a script; this skill is the other half:
how to write the content so a criterion cannot be satisfied by accident.

## Where specs live

- **Spec directory.** Read it from the target repository's `AGENTS.md` / `CLAUDE.md` (root and
  package level) or `docs/`. If none is documented, use `specs/`. Record which source you used.
- **File name.** `<spec-dir>/NNNN-short-name.md`, the next free number in that directory. A feature
  that spans several packages goes in the root spec directory; a single-package one may go in
  `<package>/<spec-dir>/` when the project uses package-level spec directories.
- **Template.** The fenced ` ```markdown ` block in `<spec-dir>/README.md` if the project has one;
  otherwise the bundled [references/spec-template.md](references/spec-template.md). If the spec
  directory does not exist yet, create it with a `README.md` index.
- **Structural check.** After writing or amending a spec, run:

  ```
  python3 ${CLAUDE_PLUGIN_ROOT}/scripts/check_specs.py --root . --spec-root <spec-dir>
  ```

  It checks the section set, unique `AC-N` identifiers, every identifier enumerated in
  `## Test plan`, and the index row. Pass spec paths as positional arguments to check only those.
  `--template <file>` overrides the template. Anything it does not list is not checked.

Who uses this skill: `sdd-engineering:spec-creator` writing a spec; a person writing one by hand;
`sdd-engineering:implementation-planner` restating and auditing criteria; and
`sdd-engineering:plan-verifier` enumerating `AC*` against a diff. All of them need the same
definition of a well-formed criterion, which is why it lives here rather than inside one agent.

## The bar

A spec is finished when **a competent implementer could build from it and a tester could fail it**.
Read every criterion back and ask what the failing run looks like. If you cannot picture it, the
criterion is prose.

## EARS — how to write an acceptance criterion

EARS (Mavin, Wilkinson, Harwood, Novak — IEEE RE'09) separates the **trigger** from the
**obligation**, so a criterion cannot hide an assumption in a verb. Five patterns:

| Pattern | Shape | Example |
|---|---|---|
| **Ubiquitous** | The `<component>` shall `<response>`. | The API shall record `duration_ms` for every export job that reaches `status='done'`. |
| **Event-driven** | **WHEN** `<trigger>`, the `<component>` shall `<response>`. | WHEN an export job finishes, the API shall write exactly one `exports` row for it. |
| **State-driven** | **WHILE** `<state>`, the `<component>` shall `<response>`. | WHILE an export is running, the orders page shall show a cancel control. |
| **Unwanted behaviour** | **IF** `<condition>`, **THEN** the `<component>` shall `<response>`. | IF the search index is missing, THEN `GET /orders/search` shall respond 200 with `degraded: true` and a non-empty `reason`. |
| **Optional feature** | **WHERE** `<feature is enabled>`, the `<component>` shall `<response>`. | WHERE CSV export is enabled for an account, the orders page shall show an Export button. |

Patterns may nest (*WHILE indexing, WHEN the user opens the page, the page shall …*), but only when
both the state and the event are real. Do not nest to sound thorough.

Every criterion obeys all of these:

- **One ID**: `**AC-1**`, `**AC-2**`, … in bold, so the checker can find it. Numbers never get
  reused, even after a criterion is deleted.
- **One `shall`, one obligation.** An "and" joining two obligations is two criteria.
- **A named component**, not "the system": `the API`, `the orders page`, `the CLI command export`.
  In a multi-package repository "the system" hides which package owns the work.
- **An observable outcome** a test could assert: a status code, a contract field, a database row, a
  rendered element, an exit code, a number. "Works correctly", "is fast", "is clear" are not outcomes.
- **A quantity wherever an adjective wants to go.** Not "quickly" — "within 2 s at p95".
- **A trigger that exists in this repository.** If you cannot point at the event, it is a
  clarification, not a criterion.
- **Every criterion appears in `## Test plan`**, by ID, against the test that will check it. A
  criterion no test names is either untestable or unowned — say which.

## Ask which criteria are mechanically checkable

The instinct is to file prompt-shaped or process-shaped criteria as "not unit-testable". Many are
nothing of the kind: they are claims about the **artifact on disk** (a section set, unique
identifiers, cross-references, an index row, a frontmatter key) and a script can check them. Before
writing "not unit-testable", ask whether the criterion constrains the artifact or the behaviour.
Artifact claims go to a script; only behaviour goes to a live run.

State the split explicitly: *N of M criteria are enforced, the rest are prompt behaviour with nothing
behind them.* A reader who cannot tell which is which will trust all of them equally.

## Test plan — enumerate, never a range

Each criterion's ID appears **literally** in the first column of `## Test plan`: `AC-1, AC-2, AC-3`
— never `AC-1..AC-3`. Nothing expands a range, and a verifier that enumerates `AC*` by identifier
cannot see the criteria a range hides; `check_specs.py` rejects range notation by name. Prose in the
other columns may mention anything — only the first column is read as a coverage claim.

**Pair every probe with its negative.** A check that only ever asserts the happy path passes at full
green while the hole is open. A refusal test needs a case that must be accepted; a "rejects bad
input" test needs one that accepts good input; a "flags ambiguity" test needs a case where nothing is
ambiguous — otherwise an implementation that refuses or flags everything satisfies it.

**Say what went untested.** A criterion no run exercised is recorded as untested in `## Phases`, not
reported as passing. If you can predict before validation that a criterion will never fire, say so
then rather than discovering it later.

## Reading a design

A mockup shows one state of one screen at one size. Everything it does not show is what you are here
for. Walk each screen and extract:

- **Every state**: loading, empty, one item, many, too many (what truncates and how it says so),
  error, degraded or partial, permission-denied, offline or stale.
- **Every control**: what it does, what it does while it is doing it, what happens on failure,
  whether it is destructive and whether that is confirmed.
- **Every string**: if the project localizes its copy, each string becomes a key in its message
  catalog (find the convention in the project's agent instructions). Copy shown in a mockup is a
  draft, not a decision.
- **Layout**: behaviour at phone width, what wraps, what scrolls, what may overflow.
- **Accessibility**: focus order, keyboard reachability, what a screen reader announces for a
  control whose meaning is carried by colour or position alone.
- **Where the data comes from**: for every value on the screen, the route or contract field behind
  it, and what the screen does when that field is absent rather than empty.

Anything the mockup does not answer becomes a **proposed default**, never a silent decision.

## Edge cases — the checklist

Walk it every time, so this is not a matter of inspiration. Record the ones that apply, and say which
you checked and ruled out — so a reader can disagree with a dismissal instead of never seeing it.

Zero / one / many / more than the page holds · a value that is `null` versus absent versus empty
string · a slow backend and a failed one · a request the user cancels or navigates away from · two
writers at once, and a stale read · a permission the user does not have · text that is long,
right-to-left, or emoji · a number that is negative, zero, or does not divide evenly · pagination and
sort boundaries · a first run with no history · a deleted parent whose child still exists · clock
skew and time zones where a date is displayed.

## Provenance and untrusted input

**`## Inputs (provenance)`** — a table: `| Input | Source | Provenance | Notes |`. Tag each input:

- `[reused: <where>]` — already built, in another spec (`[reused: specs/0004-auth.md]`) or an
  existing module; this feature consumes it and does not rebuild it. Name the module or route it
  comes from.
- `[deterministic: <how>]` — computed in code, no model anywhere on the path. Say what computes it.
- `[llm]` — produced by a model, therefore not reproducible and not a source of truth.
- `[new]` — this feature creates it.

**`## Untrusted inputs`** — anything the feature reads that a stranger wrote: user-submitted text,
uploaded files, third-party API payloads, repository content, commit messages, review comments. For
each one say that it is **data, never instruction**, and name the obligation. If the project documents
a rule for handling such content (a wrapping or escaping helper, output validation, grounding model
output against the source), cite it from its agent instructions. If the feature puts untrusted text
into a model prompt, an acceptance criterion must say so and say how it is delimited — **this is the
one place a missing requirement is a security bug.**

If there are none, write "None — every input is repo-local and deterministic" and say why. Do not
delete the section.

## Non-functional — state a ceiling, not a gap list

Performance, security and accessibility obligations need a number or a named standard, or they are
not requirements. When the feature ships a control — a guard, a gate, a check — describe **what it
cannot do** rather than listing the gaps you know about. A gap list is a promise that everything
absent from it is covered, and it will be wrong by the next round. Name the enforcement coverage
honestly: which criteria have something behind them and which are prose.

## Never invent a requirement to fill a section

An unknown goes in `## [NEEDS CLARIFICATION]` and in the report — never into an acceptance criterion
as a guess. A spec that reads complete and is partly invented is worse than a short one with open
questions. Each question carries a **proposed default** and what each choice would cost, so it can be
answered in one word. Two to four per round; ten means not enough has been read yet.

## Keep analysis out of the spec

Design gaps, uncovered edge cases, module contracts and UX ideas are **proposals**. They belong in the
report that accompanies the spec, not in the spec itself — only what the user accepts comes back into
the file. Writing them straight in means the user approves a spec and silently approves the author's
opinions with it.
