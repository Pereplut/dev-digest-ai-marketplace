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

### A Bash-granting eval refuses to run on WSL with Docker Desktop's `~/.docker` symlinks
**Date:** 2026-10-16
**Evidence:** `docs/COST-BASELINE.md` (How to run, Tool grants); `.github/workflows/evals.yml` (`--allow-tools`)
Before each run, `claude plugin eval --allow-tools Bash` (2.1.301) checks that the sandbox can hide the
Docker credential store. Docker Desktop's WSL integration makes `~/.docker/contexts` a symlink into `/mnt/c`,
and every run then errors with "credential store … holds a symbolic link … a Bash-granting evaluation
cannot run here" at $0. Setting `DOCKER_CONFIG` to an empty dir does not help, because `~/.docker` is still checked.
Run Bash cases in CI, or move the store's contents into a plain directory. `Write`/`Edit` grants
do not need the sandbox.

### Under `--ablation with-without`, `arm: with-only` graders are not scored
**Date:** 2026-10-16
**Evidence:** `plugins/sdd-engineering/evals/spec-creator-writes-spec-only/graders/boundary-stated.md` (`arm`);
`docs/COST-BASELINE.md` (Runs, "grader fix 2")
In the result JSON, each grader carries `scored`. With both arms running, every with-only grader has
`scored: false`, and so does `tool_used: Skill`, even without an `arm` key. A failing requirement check
marked with-only still leaves the run at 1.0: `boundary-stated` failed 2 of 3 runs that all scored 1.0.
Keep with-only for "the plugin fired" checks only. A grader that tests a requirement should be
`arm: both`, so the no-plugin arm failing it shows up in the delta.

### An installed plugin cannot read its own reference files without a permission
**Date:** 2026-10-16
**Evidence:** `plugins/sdd-engineering/skills/spec-authoring/SKILL.md` (Headings); `plugins/sdd-engineering/README.md`
(Recommended settings); `plugins/sdd-engineering/scripts/check_specs.py` (`is_draft`)
Installed plugins live in `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/`, which is outside
the project. A `Read` of a skill's `references/*.md` there gets "Claude requested permissions to read from
… but you haven't granted it yet". Headless sessions refuse it; interactive ones prompt. Evals do not
show this, because they run with reads allowed everywhere. Installing 1.0.0 into a fresh repository,
spec-creator therefore never saw the template and wrote `## Acceptance criteria`, and `check_specs.py`
skipped the spec and exited 0. `Read(~/.claude/plugins/cache/dev-digest-ai-marketplace/**)` in
`permissions.allow` fixes the read (verified). Anything a skill must not miss belongs in the
`SKILL.md` body, which loads without a read.

### npm and Playwright downloads fail on this WSL host with TLS record errors; retry with one socket
**Date:** 2026-10-16
**Evidence:** `site/package-lock.json` (created after retries)
`npm i` failed intermittently with `ERR_SSL_CIPHER_OPERATION_FAILED`; `--maxsockets=1` and a retry loop got
through. `npx playwright install chromium` failed every time with `ERR_SSL_DECRYPTION_FAILED_OR_BAD_RECORD_MAC`,
so the Playwright suite runs in CI (`validate.yml`, site job). The machine's network causes this, not the repo.
