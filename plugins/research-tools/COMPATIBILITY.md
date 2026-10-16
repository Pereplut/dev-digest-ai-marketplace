# Compatibility

| Requirement | Value |
|---|---|
| Claude Code | `>=2.1.110` |
| Tested on | Claude Code 2.1.301 |

The minimum is set by the marketplace's use of version-constrained plugin dependencies.

## Features relied on

- Plugin agents with `tools` / `disallowedTools` / `model` frontmatter. No feature newer than the
  minimum version is required.
- `WebFetch` and `WebSearch` must be available in the session for external mode; without them the
  agent reports external questions under Not found.

The [build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3) covers how these releases were
tested and rehearsed.
