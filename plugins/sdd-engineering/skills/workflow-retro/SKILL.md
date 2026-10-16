---
name: workflow-retro
disable-model-invocation: true
argument-hint: "[label:<slug>] [deep] [session:<id>]"
description: >-
  Reviews how a multi-agent run went, not what it produced: agents launched and in what order,
  tokens and wall-clock each spent, parallelism, where work was duplicated, which agent corrected
  which, what a brief failed to ask, and every tool denial an agent hit. Appends a dated entry to
  WORKFLOW-RETRO.md with proposed changes the user approves. Manual only; it never edits agents,
  skills or settings, and never reports a number it did not read from a tool result or journal.
---

# Workflow retrospective

`INSIGHTS.md` records what was learned about **the codebase**. This records what was learned about
**the orchestration**: how the agents were briefed, sequenced and spent. Different readers, different
lifetimes, separate logs. Never write orchestration findings into `INSIGHTS.md`, and never write
engineering findings here (those go to `sdd-engineering:engineering-insights`).

Invoked only by the user, as `/sdd-engineering:workflow-retro`, after a run worth reviewing. There is
no hook and there must never be one: do not chain it at the end of another skill or wire it to an
event. It spawns no agents: everything it needs is in the session or on disk.

## Arguments

| Token | Meaning | Default |
|---|---|---|
| `label:<slug>` | Name for the run under review. | derived from the spec or task |
| `deep` | Also parse Claude Code's own agent transcripts for exact token, cache, tool and timing data. | off |
| `session:<id>` | Which session to analyse. | the current one, `${CLAUDE_SESSION_ID}` |

If it is ambiguous *which* run to review (several distinct batches in one session), ask before
analysing; do not silently pick.

## The one rule that makes the rest possible

**Never report a number you did not read from a tool result.** Every figure cites where it came
from: a `<usage>` block, a run-journal row, the analysis script's output, `/context` output, a file.
A figure that is not available is written `not measured`, never estimated, never inferred from "about
how long it felt". A retrospective that estimates is worse than none, because it launders a guess into
a record.

Keep **measured** and **inferred** in separate columns, always. "researcher spent 90,843 tokens" is
measured. "researcher found this hard" is inferred, and must quote the report line it came from. A
figure the script **derives** from measured rows (its serial-wall estimate, for example) is labelled
derived, with the assumption it rests on.

## Capture happens during the run, not here

A retrospective composed at the end of a long session works from a **compacted** transcript, and the
numbers are already gone: the narrative survives condensation, the `<usage>` blocks do not. Most agent
returns arrive as a handback message that carries no usage data at all; the numbers come only in the
separate `<task-notification>`.

So the orchestrating session (for example `sdd-engineering:run-plan`) appends one row **as each
notification arrives** to `.sdd/retro/<session-id>.runs.jsonl` in the target repository:

```json
{"order":1,"agent":"researcher","label":"auth-flow","tokens":90843,"tools":37,"ms":162486,"parallel_with":[2,3],"outcome":"returned"}
```

`order` is launch order. `parallel_with` lists the orders launched in the same message, which is what
makes parallelism computable later. `outcome` is `returned`, `late`, `failed`, `denied` or
`superseded`. A field whose figure was not shown is left out, never filled with a guess.

This capture is a workflow rule, not part of this skill: a manual-only skill cannot run mid-session.
It is prompt discipline with no enforcement; if rows go missing often, propose a hook to the user
rather than a sterner sentence.

**When rows are missing, say so.** A retrospective over 3 captured rows of 7 agents reports three
agents measured and four `not measured`; it never scales up, averages, or quietly reports the three as
if they were the run.

## Collect the measurements

1. **Run journals (always).** Run the bundled analyser over the session's journal:

   ```
   python3 ${CLAUDE_SKILL_DIR}/scripts/analyze_journals.py --root . .sdd/retro/<session-id>.runs.jsonl
   ```

   With no path it reads every journal in `.sdd/retro/`. It prints each row, totals over the rows that
   carry a figure, which rows lack one, outcome counts, the parallel groups, and a derived serial-wall
   estimate. Add `--json` for machine-readable output.
2. **Agent transcripts (`deep`, opt-in).** Claude Code keeps per-agent transcripts under
   `~/.claude/projects/<project-slug>/<session-id>/subagents/agent-*.jsonl`, each with a sibling
   `.meta.json` (`agentType`, `description`, `spawnDepth`). These live **outside the target
   repository**, so read them only when the user passed `deep`, and show the user the exact directory
   before running the script on it. Find the project slug by matching the most recently modified
   `<session-id>.jsonl` under `~/.claude/projects/`. Then:

   ```
   python3 ${CLAUDE_SKILL_DIR}/scripts/analyze_journals.py ~/.claude/projects/<project-slug>/<session-id>/subagents/ --json
   ```

   It reports input / output / cache-read / cache-write tokens, cache hit ratio, tool calls, span and
   a parallelism factor (sum of agent spans / wall-clock). Read only through the script: a transcript
   is large, and reading one into context can overflow the session this skill runs in.
3. **Nested agents are not optional.** A subagent that holds the `Agent` tool can spawn its own, and a
   parent's `<usage>` block excludes its children. Transcripts are stored flat, so `deep` mode counts
   every depth (`spawnDepth > 1` is nested) and includes them in every total. Without `deep`, state
   that totals exclude nested agents whenever the run used an agent that can spawn others.
4. **Cost is optional and never invented.** The script reports cost only with `--prices <file>`, a
   map of current per-model rates the user supplies or you verify from the provider's pricing page.
   Without one, cost is `not measured`.

If no run is identifiable, or `deep` was requested and the transcripts cannot be found, say so plainly
and offer the in-context view instead. "Nothing to review" is a valid result; a fabricated metric is
not.

## What to compose

Read the script output, the agent reports still in context, and `/context` if the user has run it.
Then write the sections below. Omit any section with nothing real in it rather than writing "none" —
except `### Not measured`, which is never omitted.

### 1. Cost and shape

A table of every agent: order, type, label, tokens, tool uses, duration, outcome. Then:

- **Total subagent tokens vs. the main thread's message tokens.** These can diverge sharply, and the
  orchestrator cannot see subagent spend in `/context`. If the ratio is large, the orchestrator spent
  most of the budget blind.
- **Parallelism: wall-clock against summed agent duration.** A ratio near 1.0 on independent work is a
  fan-out that was serialized by mistake.
- **Cache efficiency** (`deep` only): cache-read / input-side tokens. A low ratio means something is
  breaking the prompt cache.
- **Critical path**: the agent that dominated wall-clock.
- **Termination mode**: success, cap, user stop, or dead agent. Record it always. A run that hit its
  cap often reveals the root cause no single review round did, because the stop forces "why does this
  keep happening?" instead of "what is wrong this round?".

### 2. The correction chain — the highest-value section

Who corrected whom, and **does the error trace back to the coordinator's brief?** Agent corrects agent
is ordinary. Agent corrects coordinator is a briefing defect, and it is invisible to every other review.

Shapes to look for:

- A coordinator asserts a fact it read off a mockup or a summary; the first agent that checks the code
  returns the real answer. The brief was the defect, not the agent's output.
- A wrong figure travels brief → spec → skill description, and several passes repeat it because it
  came from the coordinator, until a verifier reading end to end traces it to the source.

For each: what was claimed, who caught it, how many passes repeated it first, and where it entered. A
claim that entered through a brief and survived N passes is the strongest signal this skill produces:
it measures how far an unchecked assertion travels.

### 3. The question asked vs. the question that mattered

An agent answers what it was asked. Where a later step found something an earlier agent **had the file
open for and did not report**, that is a brief-template defect, not agent failure. Typical case: a
researcher correctly reports that a slot exists but not that it emits the exact string the new feature
will collide with — it was asked "does X exist", never "what would collide with X". Record the fix as a
brief-template line, because that is the artifact that changes.

### 4. Duplicate coverage

Compare `file:line` citations across reports from the same fan-out. Report the overlapping set and the
tokens spent on the duplicate half. Overlap is not automatically waste: two reviewers converging on one
line is corroboration, and should be named as such. Two researchers reading the same file because
neither brief said who owned it is paid-for duplication; the fix is one ownership sentence per brief,
or one shared pre-read by the orchestrator.

### 5. Capability denials

Every tool refusal an agent hit, with what it cost. These are the cheapest findings to act on and the
easiest to lose: the agent mentions it once, in a "could not find" row, and nobody collects it.

### 6. Unused output

Agent conclusions that never reached the shipped artifact. Check the report's claims against the spec,
plan or code that actually landed. Distinguish *wasted* (nobody read it) from *spent well* (it
informed a decision to cut something): a finding that killed a feature earned its cost.

### 7. Not measured

Never omitted. Every agent with no captured row, every figure unavailable, and why. A retrospective
whose limits are invisible reads as complete.

## Proposed changes

End with a checklist the user accepts or rejects. Each proposal names the file, the change, and **the
observation from this run that earned it**; never a proposal without evidence.

```
## Proposed changes
[ ] agents/researcher.md — brief template: ask "what would collide with X",
    not only "does X exist" (header collision missed, caught two steps later)
[ ] run-plan brief for reviewers — name which reviewer owns which files
    (two reviewers read the same 3 files; ~40k duplicate tokens per the journal)
```

**Never edit agent definitions, skills or settings yourself.** An agent rewriting the instructions that
govern it, from its own self-assessment, is a loop with no outside check. Propose; the user applies.
Applying an accepted proposal is a separate, explicitly approved step.

### Before proposing against a guard, find out what it is for

A proposal that would weaken a guard — a permission broadened, a cap raised, a review step dropped, a
deny entry removed — is not finished when it is labelled as a trade. **Read why the guard exists first,
and say what you found in the proposal line.** Search the project's `INSIGHTS.md` files, its specs and
the git history for what put it there. If you cannot find a reason, say that too: "no recorded
rationale" is a different claim from "the rationale does not apply here".

**Prefer the reading where the agent, not the guard, is wrong.** A denial usually means an agent reached
for the wrong tool, for example because its own prompt demonstrated a command its rules forbid. Exhaust
that explanation before proposing to remove anything. Some denied commands (`find -exec`, `find -delete`,
search tools with a preprocessor flag) can execute arbitrary programs; granting them can silently revert
a deliberate control.

Two things follow:

- A retrospective's proposals are **themselves unverified claims**. Nothing downstream checks them, so
  the verification has to happen here, before the line is written.
- **Check your own worked examples against your own rules.** A document that forbids something in prose
  and demonstrates it in a code block teaches the code block.

## Writing it

Append to `WORKFLOW-RETRO.md` at the target repository's root (create it with a one-line header if it
is missing). Newest last. One entry:

```markdown
### YYYY-MM-DD — <label> · 5 agents · 490,171 tokens · stopped: success
**Shape:** 3 researchers in parallel (2.8x), then spec-creator twice (write, then close questions).
**Subagent vs. main thread:** 490,171 vs 169.5k message tokens, 2.9x, invisible in `/context`.
**Corrections:** spec-creator corrected the coordinator twice, both claims read off a mockup.
**Not measured:** implementer (no row captured).

<sections 1–7 that have content>

## Proposed changes
[ ] ...
```

The title line carries agents, tokens and termination mode, so the log is skimmable without opening an
entry. Writing this file is the **only** write this skill makes; also print the entry in chat.

**No news, no write.** A run with nothing notable — no corrections, no duplication, no denials, no
surprising cost — produces **no entry**. Say "nothing worth recording from this run" and stop. A log
padded with uneventful runs stops being read, and then the eventful ones are lost too.

## What this skill deliberately does not do

- **No cost figure without a verified price map.** Prices change and model IDs vary; an unsourced cost
  would break the first rule.
- **No agent quality scores.** "researcher: 7/10" is a fabricated number wearing a metric's clothes.
  Report what happened and let the reader judge.
- **No raw transcript reads into context.** Use the script; full transcripts overflow the session.
- **No engineering findings.** A fact about the codebase goes to `sdd-engineering:engineering-insights`.
  If a run produced both, run both skills; do not merge the logs.
