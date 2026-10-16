# Compatibility

| Requirement | Value |
|---|---|
| Claude Code | `>=2.1.110` |
| Tested on | Claude Code 2.1.301 |

The minimum is set by the marketplace's use of version-constrained plugin dependencies.

## Features relied on

- Version-constrained plugin dependencies (object form `{ "name", "version" }`) to pull in
  `engineering-paved-path@^1.0.0`.
- The `Skill` tool inside a plugin agent, to load cross-plugin skills by namespaced name. If it is
  unavailable the agent falls back to locating the skill file with `Glob` and `Read`.
