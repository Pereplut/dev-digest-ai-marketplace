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

### `claude plugin eval` has no `--plugin-dir`; evaluate the installed plugin to get its dependencies
**Date:** 2026-10-16
**Evidence:** `.github/workflows/evals.yml` (eval step); `claude plugin eval --help` on 2.1.301
The eval subcommand takes a path, a plugin name or a `plugin@marketplace` id. It has no flag for loading
sibling plugin directories. `claude plugin eval plugins/sdd-engineering` therefore runs without
`engineering-paved-path`, `research-tools` and `architecture-review`, and every namespaced reference to them
misses. Instead, add this checkout with `claude plugin marketplace add ./`, install the plugin (its
dependencies install with it), then run `claude plugin eval sdd-engineering@dev-digest-ai-marketplace`.
`--eval-dir` is a folder name *below* the plugin, not a path.

### npm and Playwright downloads fail on this WSL host with TLS record errors; retry with one socket
**Date:** 2026-10-16
**Evidence:** `site/package-lock.json` (created after retries)
`npm i` failed intermittently with `ERR_SSL_CIPHER_OPERATION_FAILED`; `--maxsockets=1` and a retry loop got
through. `npx playwright install chromium` failed every time with `ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC`,
so the Playwright suite runs in CI (`validate.yml`, site job). The machine's network causes this, not the repo.
