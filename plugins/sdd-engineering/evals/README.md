# sdd-engineering evals

Behaviour evals for `claude plugin eval`, for maintainers. Using the plugin never runs them. How the
suite was built, what it measured and the grader mistakes it caught are summarized in the
[build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3). The full numbers, and how to run
the suite, are in
[COST-BASELINE](https://github.com/Pereplut/dev-digest-ai-marketplace/blob/main/docs/COST-BASELINE.md).

This file is not read by the eval runner, which only loads each case's `case.yaml`, `prompt.md` and
`graders/`. Do not put links or notes into those: `prompt.md` is the exact message sent in a run and
the grader bodies are the judge's instructions, so any change there changes what is measured.

## Cases

| Case | Tags | Checks |
|---|---|---|
| `spec-creator-writes-spec-only` | spec | One draft spec in EARS form, open questions, the write boundary stated; no code or plan |
| `spec-creator-covers-mandatory` | spec | Each of four mandatory requirements gets its own acceptance criterion; coverage reported |
| `planner-reads-project-facts` | plan | Verify commands, user-owned commands and protected paths taken from the repo and cited |
| `no-verify-command` | plan | "No verify command found", and a question instead of an invented command |
| `planner-refuses-draft-spec` | plan, negative | Refuses to plan against a draft spec and leaves it unchanged |
| `arch-review-severity` | review | An application-to-infrastructure import graded `CRITICAL` with evidence; nothing edited |
| `spec-and-plan-locations` | run-plan, negative | With no saved plan, run-plan stops and names the plan path it expected |
| `unrelated-request` | negative | No SDD agent or skill for an unrelated question |
| `retro-not-auto` | negative | `workflow-retro` is not invoked on its own |
| `run-plan-gate-order` | run-plan, heavy | Default order: implementer, plan-verifier gate, architecture-reviewer; doc-writer runs |
| `run-plan-optional-stages` | run-plan, heavy | `--tests --no-docs`: test-writer runs, doc-writer does not |

The two `heavy` cases need `Bash`. They were skipped for the baseline and can run in CI with
`--tag heavy` (the `evals` workflow) once the `ANTHROPIC_API_KEY` secret is set.

## Layout

- `<case>/case.yaml`: loads the plugin **and its three dependencies** (`plugins:`) and names the scaffold script.
  Without the dependencies the plugin is rejected and the run measures the bare model.
- `<case>/prompt.md`: the run's settings in frontmatter, and the prompt as its body.
- `<case>/graders/*.md`: one grader per file.
- `<case>/scaffold.json` and `fixture.sh`: the workspace a run starts in. `fixture.sh` is generated
  from `fixtures/` by `scripts/build-eval-fixtures.mjs`; edit the sources and regenerate.
- `fixtures/orders-api/`: a small Node API used as the base repository, with variants in
  `fixtures/overlays/`.

`scripts/check-evals.mjs` lints every case (grader schema, dependency list) in `./scripts/check.sh`.
