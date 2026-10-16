# Cost baseline

What the `sdd-engineering` workflow costs to run, measured with its behaviour evals, and the record
of each optimization tried against that baseline (spec 0001 AC-22). Every number here comes from
a `claude plugin eval` run whose `aggregate-result.json` was kept. A number that was not measured
says so.

## The eval suite

`plugins/sdd-engineering/evals/` has one case per behaviour that spec 0001 promises:

| Case | Spec | Tags | Runs | What passes |
|---|---|---|---|---|
| `spec-creator-writes-spec-only` | AC-14, AC-19 | spec | 3 | one draft `specs/0002-*.md` in EARS form with open questions; no code, no plan; boundary stated as prompt-only |
| `planner-reads-project-facts` | AC-10 | plan | 3 | verify and user-owned commands taken from `AGENTS.md` and cited; no invented requirements; no writes |
| `no-verify-command` | AC-11 | plan | 3 | "no verify command found", and a question instead of an invented command |
| `planner-refuses-draft-spec` | AC-10 | plan, negative | 3 | stops on a `draft` spec and leaves it `draft` |
| `arch-review-severity` | AC-15 | review | 3 | the application → infrastructure import graded `CRITICAL` with `file:line`; nothing edited |
| `spec-and-plan-locations` | AC-19 | run-plan, negative | 3 | with no saved plan, stops and names `.sdd/specs-0001-orders-csv-export.plan.md` |
| `run-plan-gate-order` | AC-16, AC-17 | run-plan, heavy | 1 | implementer → plan-verifier → architecture-reviewer; doc-writer runs; test-writer does not |
| `run-plan-optional-stages` | AC-17 | run-plan, heavy | 1 | `--tests --no-docs`: test-writer runs after the gate; doc-writer does not |
| `retro-not-auto` | AC-18 | negative | 3 | `workflow-retro` is not invoked on its own |
| `unrelated-request` | AC-24 | negative | 3 | no SDD agent or skill for an unrelated question |

**Fixture.** Every case starts from `evals/fixtures/orders-api/`, a dependency-free Node API with an
`AGENTS.md` (verify commands, a user-owned integration command, protected migrations), an onion
layering doc, a specs index and one approved spec. `evals/fixtures/overlays/` holds the per-case
variants: no verify commands, a draft spec, a layering violation left uncommitted, a saved plan, a
retro journal.

`claude plugin eval` starts each run in an empty workspace, so each case seeds it with
`fixture.sh`. That script is **generated** from the case's `scaffold.json` by
`scripts/build-eval-fixtures.mjs` and carries its files inline. Edit the fixture sources, then
regenerate; `check.sh` fails on a stale script. The scripts only write files and make one git
commit, which is why running the suite with `--scaffold` is safe.

**Graders.** Deterministic graders do the counting: `tool_used` and `tool_order` on `Agent` and
`Skill` inputs, `file_exists`, and `regex` on files and transcripts. An `llm` grader (Haiku by
default) judges the parts that need reading, and each of its criteria names what FAIL looks like.
Graders that only make sense with the plugin loaded are `arm: with-only`. The negative graders are
`arm: both`, so the no-plugin baseline is held to them too. `scripts/check-evals.mjs` checks the
documented grader schema, because the CLI does not check graders when it loads a suite.

## How to run

The whole suite needs an API credential and spends tokens. Run a subset first.

```
# From the marketplace root. Cheap first: the negative cases, one run each, no baseline arm
claude plugin eval . --eval-dir plugins/sdd-engineering/evals \
  --tag negative --runs 1 --ablation none --scaffold --trust-plugin --max-cost-usd 2 --no-publish

# Baseline: every case, default runs, with the no-plugin arm, one fixed model
claude plugin eval . --eval-dir plugins/sdd-engineering/evals --allow-tools Bash Write Edit \
  --model <model> --scaffold --trust-plugin --max-cost-usd 25 --json baseline.json --no-publish
```

**Tool grants.** A case's `allowed_tools` grants only read-only tools (`Read`, `Glob`, `Grep`, `Skill`,
`Agent`, …). `Write`, `Edit` and `Bash` take `--allow-tools`, and that grant applies to every case
in the run. Granting `Bash` runs each command in the OS sandbox: on Linux, install `bubblewrap` and
`socat`. The sandbox also refuses every run (cost $0, error in the result) when `~/.docker` holds a
symlink, as Docker Desktop's WSL integration creates (`contexts -> /mnt/c/...`). `DOCKER_CONFIG` does
not change that check. On such a machine, run the Bash cases in CI. `--case` does not negate
(`!run-plan-*` matches nothing), so select with `--tag`, which keeps cases matching any listed tag:
`--tag spec plan review negative` is every case except the two heavy ones.

**Why the root, and why `plugins:` in every case.** The eval loads only the plugin directories a
case lists in `plugins:`, and it refuses any of them that sit outside the directory it was given.
Run against `plugins/sdd-engineering` (or the installed `sdd-engineering@dev-digest-ai-marketplace`,
which the eval reads from the same folder), it loads the plugin alone as `sdd-engineering@inline`.
That copy is then rejected as `dependency-unsatisfied`, and the run goes on with **no plugin
loaded**. Negative cases still pass, for the wrong reason: the first run on 2026-10-16 scored
2/4 that way. So each `case.yaml` lists the plugin and its three dependencies, and the command
targets the marketplace root. `scripts/check-evals.mjs` fails a case that omits a dependency.

In CI, use the `evals` workflow (Actions → evals → Run workflow). It is manual-only, takes a case
glob, a tag, runs, model and a cost ceiling, and uploads `results.json` and `report.html`. It needs
the `ANTHROPIC_API_KEY` repository secret. Cases that grant `Bash` need the OS sandbox
(`bubblewrap` and `socat` on Linux); the workflow installs them.

## Baseline

Measured 2026-10-16. Covers **8 of 10 cases**. The two heavy run-plan cases need `Bash`, which this
machine's sandbox refuses ([Tool grants](#how-to-run)), so they still have to run in CI.

| Field | Value |
|---|---|
| Date | 2026-10-16 |
| Commit | `73383f2` (graders as of the commit that adds this table) |
| Claude Code | 2.1.301 |
| Model (cases / judge) | `claude-opus-5-5` (fixed with `--model`) / haiku |
| Runs per case | 3, both arms (`--ablation with-without`), `--allow-tools Write Edit` |
| Mean score with plugin | **0.93** |
| Mean score without plugin | 0.47 |
| Δ vs. no-plugin arm | **+0.47** |
| Runs passing every scored grader | 20 / 24 (83%) with plugin; 6 / 24 without |
| Median cost per run, with plugin | $0.23 (range of case medians $0.07–$0.50) |
| Median latency per run, with plugin | 55 s (range 8–152 s) |
| Tokens | Recorded only for the two rerun cases (table below); the other runs' traces were not kept |
| Tool calls per run (median) | Same: 11 and 18 with plugin |
| Critical failures | **0**: no run wrote code, wrote a plan, approved a spec, ran the retro unasked, or dispatched an SDD agent on an unrelated request |
| Cost of this table | $8.72 (8 cases) + $3.21 (2 cases rerun after the grader fixes below) |

Per case. The scores come from `aggregate-result.json`: six cases from the 8-case run, and
`spec-*` from the rerun.

| Case | With | Without | Δ | Pass (with) | Median cost with / without | Median s | Failures with plugin |
|---|---|---|---|---|---|---|---|
| `arch-review-severity` | 0.83 | 0.33 | +0.50 | 2/3 | $0.210 / $0.056 | 57 | 1× `finding-quality` (judge 1 PASS, 2 FAIL) |
| `no-verify-command` | 1.00 | 0.17 | +0.83 | 3/3 | $0.417 / $0.063 | 117 | — |
| `planner-reads-project-facts` | 0.80 | 0.40 | +0.40 | 2/3 | $0.405 / $0.064 | 119 | 1× `project-facts-cited` |
| `planner-refuses-draft-spec` | 1.00 | 0.33 | +0.67 | 3/3 | $0.166 / $0.058 | 52 | — |
| `retro-not-auto` | 0.93 | 1.00 | −0.07 | 2/3 | $0.124 / $0.105 | 29 | 1× `answers` (judge 1 PASS, 2 FAIL); the retro was never invoked |
| `unrelated-request` | 1.00 | 1.00 | 0 | 3/3 | $0.069 / $0.044 | 8 | — |
| `spec-and-plan-locations` | 1.00 | 0.20 | +0.80 | 3/3 | $0.244 / $0.286 | 27 | — |
| `spec-creator-writes-spec-only` | 0.88 | 0.29 | +0.58 | 2/3 | $0.499 / $0.061 | 152 | 1 run: no `Write boundary:` line in the report, and `spec-quality` FAIL |
| `run-plan-gate-order` | — | — | — | — | — | — | not run (needs Bash) |
| `run-plan-optional-stages` | — | — | — | — | — | — | not run (needs Bash) |

Tokens and tool calls (`node scripts/eval-usage.mjs`, medians from kept traces, subagents included):

| Case | Arm | Output | Cache read | Cache write | Input | Tool calls |
|---|---|---|---|---|---|---|
| `spec-and-plan-locations` | with | 2,246 | 79,997 | 22,749 | 8 | 11 |
| `spec-and-plan-locations` | without | 5,686 | 122,569 | 19,825 | 20 | 23 |
| `spec-creator-writes-spec-only` | with | 13,640 | 114,266 | 32,919 | 16 | 18 |
| `spec-creator-writes-spec-only` | without | 700 | 17,008 | 5,447 | 4 | 2 |

**Reading it.**
- The negative cases make no difference with or without the plugin (`unrelated-request` 0,
  `retro-not-auto` −0.07). That is the intended result: the plugin must not change behaviour where
  it does not apply.
- The `retro-not-auto` dip is one LLM-judge vote on the reply's wording. It is not the retro running.
- `spec-and-plan-locations` is the one case where the plugin is *cheaper* than no plugin. Without
  it, the model explores the repo for 23 tool calls and then edits the spec. With it, run-plan stops
  at the missing plan after 11 calls.
- The one consistent quality gap is `spec-creator` occasionally leaving out the `Write boundary:` line
  (1 of 3 here; 1 of 3 in the previous rerun). That is a 1.1.0 candidate.

**Grader fixes made before these numbers.** The graders were changed for being wrong, never to pass:
- `spec-creator-writes-spec-only` first failed `spec-quality` 3/3 because the judge had `focus: trace`
  and never saw the file. Next, it penalised the input-provenance citations the spec format
  requires, and it looked for the boundary line in the parent's summary rather than in the agent's
  report. Now the spec file is judged on its own (exact path named in the prompt), the boundary line
  is a regex on the trace, and the open questions are judged on the reply.
- Under `--ablation with-without`, an `arm: with-only` grader is reported but **not scored**, and
  `tool_used: Skill` is with-only implicitly. Four graders that check a spec requirement
  (`boundary-stated`, `report-quality`, `names-plan-path`, `tells-user-to-plan`) are now
  `arm: both`. Only "did the plugin fire" checks (agent dispatch, skill loaded) stay with-only.

## Runs

Every run is listed, including the ones that measured nothing, so the cost of getting the suite
working is on record. All on Claude Code 2.1.301, the CLI default model (`claude-opus-5-5`), with a Haiku judge.

| Date | Commit | Scope | Result | Cost | Wall time | Notes |
|---|---|---|---|---|---|---|
| 2026-10-16 | `de2fbac` | `--tag negative --runs 1 --ablation none`, installed-plugin target | 2/4 (score 0.69) | $0.32 | 69 s | **Invalid.** `sdd-engineering@inline` rejected as `dependency-unsatisfied`; no plugin was loaded. The two passes are the bare model. |
| 2026-10-16 | `de2fbac` + `plugins:` | same, plugin-dir target | 0 cases loaded | $0 | 0 s | Refused: `plugins` entries outside the containment root `plugins/sdd-engineering`. |
| 2026-10-16 | `de2fbac` + `plugins:` | same, marketplace-root target | **4/4** (score 1.0) | $0.66 | 122 s | All 4 plugins loaded, no `plugin_errors`; 8 agents, 7 skills namespaced. |
| 2026-10-16 | `73383f2` | `arch-review-severity`, 1 run, `--allow-tools Bash Write Edit` | 0 runs | $0 | 0 s | Sandbox refused: `~/.docker` holds a symlink (Docker Desktop on WSL). Also refused with `DOCKER_CONFIG` pointing at an empty dir. |
| 2026-10-16 | `73383f2` | **baseline**: `--tag spec plan review negative`, 3 runs, both arms, `--allow-tools Write Edit` | 0.89 with / 0.50 without | $8.72 | 723 s | 8 cases, `-j 3`. `spec-creator` 0.57: grader could not see the file (fixed) |
| 2026-10-16 | + grader fix 1 | `spec-creator-writes-spec-only`, 3 runs, both arms | 0.67 with | $1.59 | 147 s | Judge now sees the file. It penalised provenance citations, and the boundary was checked in the parent's reply (fixed) |
| 2026-10-16 | + grader fix 2 | same | 1.00 with | $1.54 | 140 s | Boundary regex failed 2/3 but was **not scored** (with-only under with-without) |
| 2026-10-16 | + arms fixed | `--case 'spec-*'`, 3 runs, both arms | 0.94 with / 0.25 without | $3.21 | 258 s | Rows used in the baseline table |
| 2026-10-16 | `dc0752a` (tag 1.0.0) | `spec-creator-covers-mandatory`, 3 runs | 0.76 recorded, 4/4 requirements after rescoring | $1.44 | — | [Release comparisons](#release-comparisons) |
| 2026-10-16 | 1.1.0 candidate | `--case 'spec-creator-*'`, 3 runs | 0.86 / 0.93 recorded | $2.99 | — | same |

Per case, the first valid negative run (one run each):

| Case | Score | Cost | Turns | What the trace showed |
|---|---|---|---|---|
| `planner-refuses-draft-spec` | 1.0 | $0.221 | 2 | Dispatched `sdd-engineering:implementation-planner`, which stopped on `status: draft` |
| `retro-not-auto` | 1.0 | $0.123 | 8 | Answered from `.sdd/retro/*.runs.jsonl`; `workflow-retro` not invoked |
| `spec-and-plan-locations` | 1.0 | $0.249 | 14 | `/sdd-engineering:run-plan 0001` ran the skill (it read `references/*.md`), found no plan, named `.sdd/specs-0001-orders-csv-export.plan.md` |
| `unrelated-request` | 1.0 | $0.067 | 1 | Answered directly; no Agent or Skill call |

## Release comparisons

### sdd-engineering 1.0.0 → 1.1.0 (2026-10-16)

`claude-opus-5-5`, `--ablation none`, 3 runs per cell. 1.0.0 ran from a worktree of
`sdd-engineering--v1.0.0`, with the new case copied in.

| Case | Grader | 1.0.0 | 1.1.0 |
|---|---|---|---|
| `spec-creator-covers-mandatory` | each of the 4 mandatory requirements has an AC | 12/12 | 12/12 |
| | `## Requirement coverage` in the agent's report | 0/3 | **3/3** |
| | median cost | $0.484 | $0.496 |
| `spec-creator-writes-spec-only` | `Write boundary:` line in the report | 5/9 (earlier runs) | **3/3** |
| | `spec-quality` (judge on the file) | 5/6 | 2/3 |
| | median cost | $0.467 | $0.536 |

**Reading it.**
- The coverage rule did not change coverage on this case: 1.0.0 already covered all four
  requirements. So the case shows no regression, not an improvement. Showing one would take a case
  with more requirements, or less prominent ones.
- The rule's visible effect is the reported table. That lets a reviewer check coverage without
  reading the spec.
- The boundary line went from unreliable to present every time.
- The cost difference is inside the spread seen in the 9-run sample ($0.42–$0.51) for the new case.
  It is at its edge for the old one; recheck it when the baseline is rerun.

**Grader fixes during the comparison.** These were deterministic, so the six runs were **rescored
offline**: each spec was rebuilt from its trace's `Write` and `Edit` calls, and every recorded verdict
was reproduced first. The per-requirement regexes matched only one line. spec-creator wraps long
criteria, so a covered requirement read as missing (1.1.0 run 2, three false failures). They now
span the whole `**AC-N**` item. The default-limit grader also missed the phrasing "carries no
`limit`" (1.0.0 runs 1 and 3, two false failures).

## Optimization log

One change at a time, measured on the same cases, model and runs as the baseline. If the change is
within run-to-run noise, the result is recorded as "within noise".

| # | Date | Change | Cases | Before | After | Verdict |
|---|---|---|---|---|---|---|
| 1 | 2026-10-16 | Remove from `spec-creator` the passages its always-loaded skill `spec-authoring` already states: the bar, hard rules 3–4 in full, *Where the spec goes*, the checker's rule list, the clarification-question rules, a quality-bar line. Agent 10,302 → 9,003 bytes (−13%, ≈340 tokens). The plan assumed the EARS rules were duplicated; they were not, the agent already pointed to the skill. | `spec-creator-writes-spec-only`, 3 runs, `claude-opus-5-5`, `--ablation none` | 9 runs: median **$0.467** ($0.421–0.510), output 10.8–14.0k, tools 16–19, `spec-quality` 5/6, boundary line 5/9, score 0.875 | 3 runs: median **$0.482** ($0.475–0.503), output 11.4–12.2k, tools 17–18, `spec-quality` 1/3, boundary line 1/3, score 0.80 | **Within noise on cost; reverted.** The theoretical saving (≈340 cached tokens per subagent turn, ≈$0.002 a run) is far below the ±$0.04 run-to-run spread. Quality moved the wrong way, not significantly at n=3, but with no gain to weigh it against. $1.46 to measure. |

What it shows about where the cost is: a spec-creator run is ≈12k output tokens and ≈110k cache reads.
The agent prompt is ≈2.5k of those input tokens. Output dominates the cost (the spec plus a ~7 KB report), and
so does the context the agent reads (repo files, the 11.5 KB skill, the template). The next optimization
worth measuring targets output: a shorter report format (it repeats the AC table that is already in the
spec file), not a shorter prompt.

## Known gaps

Settled by the 2026-10-16 negative run (traces kept with `--keep-temp`):

- **Agent dispatch matching: works.** The trace's tool list names the tool `Task`, but the `tool_used`
  grader matches `tool: Agent`. Its JSON input carries `"subagent_type": "sdd-engineering:implementation-planner"`,
  so the `input_match` patterns hold.
- **Manual-only skills from a prompt: work.** A prompt that starts with `/sdd-engineering:run-plan` expands
  into the skill even though it is `disable-model-invocation: true`.
- **`regex` on a file: the path is relative to the workspace root.** Whether a *missing* file fails the
  grader is still unverified.
- **Dependencies: not loaded unless listed.** See [How to run](#how-to-run).

Still open:

- **Unattended run-plan.** `run-plan` normally asks the user to confirm the execution mode. The
  heavy cases state the mode in the prompt and tell it to take the documented defaults. Not run yet.
- **Heavy cases.** `run-plan-gate-order` and `run-plan-optional-stages` need `Bash`. Run them in CI
  (`evals` workflow, tag `heavy`), then add them to the baseline.

Settled by the baseline: a marketplace-root target with `--ablation with-without` does run the
no-plugin arm. The plugin's agents are then absent ("Agent type … not found"). `--case` takes a
plain glob with no `!` negation and no `{a,b}` braces.
