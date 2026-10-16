# Spec template

The default shape of a spec file. A project that keeps its own template puts it in a fenced
` ```markdown ` block inside `<spec-dir>/README.md`; that block then wins over this file.
`check_specs.py` reads the required section list from whichever template applies, so the list is
never copied anywhere else.

File name: `<spec-dir>/NNNN-short-name.md` (default `<spec-dir>` is `specs/`). A feature that spans
several packages goes in the root spec directory; a single-package feature may go in
`<package>/<spec-dir>/`. Numbering is per directory.

```markdown
---
title: Export orders as CSV
status: draft        # draft | approved | in-progress | done
owner: "@handle"     # optional
packages: [api, web] # optional; the packages or modules this touches
supersedes: specs/NNNN-old-name.md   # optional
---

## Problem & why
## Goals / Non-goals
## User stories
## Acceptance criteria (EARS)
## Edge cases
## Non-functional
## Inputs (provenance)
## Untrusted inputs
## [NEEDS CLARIFICATION]
## Test plan
## Phases
| Phase | Date | Note |
|---|---|---|
| Initiation | | request read, existing specs and insights checked |
| Planning | | spec approved, decisions |
| Implementation | | |
| Validation | | typecheck · lint · tests · manual check |
| Completion | | status done, docs, insights wrap-up |
```

## Section notes

- **Status** — `draft` → `approved` (set only by a human owner) → `in-progress` (set when
  implementation starts) → `done` (set only after the completeness gate is clean).
- **Acceptance criteria (EARS)** — one bold `**AC-N**` per criterion, in a list or a table, in
  [EARS](https://alistairmavin.com/ears/) form. IDs are unique within the spec and are never reused,
  even after a criterion is deleted. Every ID reappears in `## Test plan`.
- **Test plan** — a table whose first column claims coverage. **Enumerate identifiers there, never a
  range**: `AC-1, AC-2, AC-3`, not `AC-1..AC-3`. Prose in the other columns may mention anything;
  only the first column is read as a coverage claim.
- **Inputs (provenance)** — `| Input | Source | Provenance | Notes |`, each input tagged `[reused: …]`,
  `[deterministic: <how>]`, `[llm]` or `[new]`.
- **Untrusted inputs** — anything a stranger wrote that the feature reads. Write "None, because …"
  rather than deleting the section.
- **[NEEDS CLARIFICATION]** — open questions, each with a proposed default; delete the heading once it
  empties. A `## Decisions` table (`| Question | Decision | Consequence |`) may follow
  `## Goals / Non-goals` once they are answered. Both sections are optional to the checker.
- **Phases** — filled in as the work moves, one row per workflow phase.

## Index

Every spec directory carries a `README.md` with one row per spec, linking the file by name:

```
| Spec | Status | Packages |
|---|---|---|
| [0001-export-orders-csv](0001-export-orders-csv.md) | draft | api, web |
```

A spec without the `## Acceptance criteria (EARS)` heading is treated as predating the template and is
not checked.
