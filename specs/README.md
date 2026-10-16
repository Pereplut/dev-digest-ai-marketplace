# Specs

How things **will be**. One spec per feature: `NNNN-short-name.md`, with frontmatter `status: draft | approved | in-progress | done`.
Only a human owner sets `approved`.

| ID | Title | Status |
|---|---|---|
| [0001](0001-plugin-structure.md) | Plugin structure — sdd-engineering and its dependency plugins | in-progress |
| [SITE](../docs/SITE-SPEC.md) | Static marketplace catalog on GitHub Pages | approved |

## Template

Specs in this repository use these sections. `scripts/check_specs.py` reads this fenced block.
`Decisions` is optional.

```markdown
---
id: NNNN
title: <title>
status: draft
owner: "@<handle>"
created: YYYY-MM-DD
---

# NNNN — <title>

## Problem
## Goals
## Non-goals
## Acceptance criteria (EARS)
## Edge cases
## Decisions
## Test plan
## Phases
```
