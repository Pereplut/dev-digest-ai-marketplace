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
# Local, cheap first: the negative cases, one run each, no baseline arm
claude plugin marketplace add ./
claude plugin install sdd-engineering@dev-digest-ai-marketplace
claude plugin eval sdd-engineering@dev-digest-ai-marketplace --eval-dir evals \
  --tag negative --runs 1 --ablation none --scaffold --trust-plugin --max-cost-usd 2 --no-publish

# Baseline: every case, default runs, with the no-plugin arm, one fixed model
claude plugin eval sdd-engineering@dev-digest-ai-marketplace --eval-dir evals \
  --model <model> --scaffold --trust-plugin --max-cost-usd 25 --json baseline.json --no-publish
```

In CI, use the `evals` workflow (Actions → evals → Run workflow). It is manual-only, takes a case
glob, a tag, runs, model and a cost ceiling, and uploads `results.json` and `report.html`. It needs
the `ANTHROPIC_API_KEY` repository secret. Cases that grant `Bash` need the OS sandbox
(`bubblewrap` and `socat` on Linux); the workflow installs them.

## Baseline

**Not measured yet.** Fill in this table from the first full run.

| Field | Value |
|---|---|
| Date | — |
| Commit | — |
| Claude Code | — |
| Model (cases / judge) | — / haiku |
| Runs per case | 3 (heavy cases: 1) |
| Pass rate (with plugin) | — |
| Δ vs. no-plugin arm | — |
| Median cost per case | — |
| Median latency per case | — |
| Tokens (input / output / cache read) | — |
| Tool calls per case (median) | — |
| Critical failures | — |
| Total cost | — |

Per case:

| Case | Score | Pass | Median cost | Median latency | Notes |
|---|---|---|---|---|---|
| (from `aggregate-result.json`) | | | | | |

## Optimization log

One change at a time, measured on the same cases, model and runs as the baseline. If the change is
within run-to-run noise, the result is recorded as "within noise".

| # | Date | Change | Cases | Before | After | Verdict |
|---|---|---|---|---|---|---|
| 1 | — | Planned: remove instructions duplicated between agent prompts and the skills they load (start with the EARS rules repeated in `spec-creator` and `spec-authoring`) | all | baseline | — | — |

## Known gaps

These were not verifiable from the documentation. The first run settles them; record what it shows
here.

- **Agent dispatch matching.** The docs show `input_match` only for `Skill`. The `Agent` graders
  assume the tool input is JSON containing `"subagent_type": "<plugin>:<agent>"`.
- **Manual-only skills from a prompt.** `run-plan` is `disable-model-invocation: true`. The run-plan
  cases start their prompt with `/sdd-engineering:run-plan`, which assumes the slash command expands
  in an eval run.
- **`regex` on a file.** `target: {source: file, path: ...}` is assumed to be relative to the
  workspace root, and a missing file is assumed to fail the grader.
- **Unattended run-plan.** `run-plan` normally asks the user to confirm the execution mode. The
  heavy cases state the mode in the prompt and tell it to take the documented defaults.
