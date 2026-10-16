# Insights

Append-only log of non-obvious findings. Each entry is dated and cites evidence.

### `node --test <dir>` fails on Node 22; pass a glob
**Date:** 2026-10-16
**Evidence:** `scripts/check.sh` (node unit tests step)
`node --test test/js/` treats the directory as a module and fails with `MODULE_NOT_FOUND`. Use a quoted glob:
`node --test "test/js/**/*.test.mjs"`.

### Verify plugin registration cheaply via the stream-json init event
**Date:** 2026-10-16
**Evidence:** `AGENTS.md` (Verify table, local load row)
`claude -p "Reply OK" --max-turns 1 --output-format stream-json --verbose --plugin-dir <each plugin>`. The first
line (`type: system, subtype: init`) lists `plugins`, `agents` and `skills` with namespaced names, which proves the
components load without a full eval run. On 2.1.301 it showed all 8 agents and 7 skills as `<plugin>:<name>`.
Skills with `disable-model-invocation: true` still appear in `skills` and `slash_commands`.
