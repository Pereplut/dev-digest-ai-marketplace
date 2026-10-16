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

### `claude plugin eval` loads a plugin without its dependencies; list them in `plugins:` and run from the root
**Date:** 2026-10-16
**Evidence:** `plugins/sdd-engineering/evals/*/case.yaml` (`plugins:`); `scripts/check-evals.mjs` (`loadedPlugins`);
`docs/COST-BASELINE.md` (Runs)
The eval loads only the plugin directories a case lists in `plugins:`, defaulting to the enclosing
plugin, as `<name>@inline`. Installing first does not help, because an installed target is read from the same
folder. Without its dependencies, `sdd-engineering@inline` is rejected (`plugin_errors: dependency-unsatisfied`
in the trace's init line) and **the run continues with no plugin**. Negative cases then pass for the wrong
reason. Listing the sibling dirs (`"../../../engineering-paved-path"`) is refused when the target is the
plugin dir, because they are outside its containment root. Target the marketplace root instead:
`claude plugin eval . --eval-dir plugins/sdd-engineering/evals`. `--eval-dir` takes a relative path,
not only a folder name. Always check the init line's `plugin_errors` before trusting a pass.

### npm and Playwright downloads fail on this WSL host with TLS record errors; retry with one socket
**Date:** 2026-10-16
**Evidence:** `site/package-lock.json` (created after retries)
`npm i` failed intermittently with `ERR_SSL_CIPHER_OPERATION_FAILED`; `--maxsockets=1` and a retry loop got
through. `npx playwright install chromium` failed every time with `ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC`,
so the Playwright suite runs in CI (`validate.yml`, site job). The machine's network causes this, not the repo.
