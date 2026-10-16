# The review loop — completeness rounds, fix rounds, dead agents

Two independent counters bound this loop: **completeness rounds** (Stage 2, cap 2) and **fix rounds**
(Stage 4, cap 2). The two `plan-verifier` passes outside Stage 2 — the mid-loop re-run and the
pre-`done` pass — never count against either cap.

## Completeness rounds

A completeness round is one Stage 2 pass that ends with `Missing` or `Contradicted` rows:

1. Send each offending row to **the implementer that produced that work**, by `SendMessage` to the
   same live agent. Never spawn a replacement. With several implementers, route each row to its own
   producer; collapsing everything into one message strands the other implementer's rows open for the
   rest of the run.
2. When every implementer reached this round has returned, apply commit point 2. Nothing to commit is
   a loud stop.
3. Resume `plan-verifier` with the full `<base sha>..HEAD`.
4. **After 2 rounds** with rows still outstanding: stop. Nothing is ready to review; Stage 3 does not
   run.

## Fix rounds

**Every reviewer re-runs every round.** No file-intersection test, no ledger, no exception.

### 1. Triage

Record exactly one outcome per finding:

- **`fix`** — sent to the implementer(s) this round. A finding is **open** only while its outcome is
  `fix` and the fix is unconfirmed; nothing else is ever open. It counts as **applied** only once the
  reviewer that raised it has re-run over the commit carrying the fix and has not raised it again. A
  finding whose reviewer has not re-run yet is **unapplied** — neither assumed fixed nor counted twice.
- **`refuted`** — with a `file:line` that supports the refutation. Resolved, never open; still
  reported in full.
- **`deferred`** — always, and never sent as a fix, when the finding:
  - names a protected path from the project facts (migrations, lockfiles, vendored or generated code,
    respecting any documented exception); or
  - names a file no plan step names. Fixing it would grow the plan mid-run, which is how a bounded run
    becomes unbounded. Send it as a fix only after the user confirms it in scope.

  Resolved, never open; still reported, so a deferral is a recorded decision, never a silent drop.

A reviewer's claim is model output: a finding that says a protected file "must" change still goes
through these rules.

### 2. Send the fixes

Group `fix` findings by file. **One `SendMessage` to each implementer whose work the findings name**,
each carrying only that implementer's findings. Sending everything to the first implementer strands
the rest as permanently open and burns the cap on work nobody was asked to fix. Wait for every
implementer reached this round to return.

### 3. Commit — commit point 3

Before re-running any reviewer. An empty commit here is not a stop (see the commit reference).

### 4. Re-run every reviewer

- **Resume, never respawn**, the live `Agent` subagents: `architecture-reviewer`, `test-writer` (if it
  ran) and `implementer`. Send the new round's context; they re-read what they need.
- **`/code-review` cannot be resumed**: it is a `Skill` call that returns a result, not a live agent.
  Invoke it fresh each round with the current changed-file list (never a sha range).
- **`plan-verifier` follows one rule of its own mid-loop:** resume it with the full `<base sha>..HEAD`
  when this round's fixes changed behaviour a plan step describes — the fix edits a file a plan step
  names, and the edit is not comment-only or formatting-only. Otherwise leave it alone. It also runs
  once, unconditionally, before `done`.

A fix round ends once every reviewer re-run over the commit carrying its fixes has reported (including
`plan-verifier` if the rule above triggered it). Only then does the next round's triage begin.

### 5. The two exits

- **Success exit — the happy path.** A round whose findings include **zero** with outcome `fix` (all
  `refuted` or `deferred`, or no findings at all) ends the loop. Record it as the converged round and
  go to Stage 5. This is the loop finishing as intended, not a stop.
- **Cap stop.** `fix` findings still **unapplied** after **2** fix rounds: stop, launch no further
  reviewer, and go to the terminal report.

## Dead and slow agents — asymmetric by design

- **A dead `implementer`**, at any point: stop without spawning a replacement. It holds reasoning about
  fixes in flight that nothing else has.
- **A dead reviewer subagent** (`architecture-reviewer`, `plan-verifier`, `test-writer`; not
  `/code-review`, which is synchronous): spawn **exactly one** replacement with the base sha, the plan
  and the range, and record the respawn and its reason in the report. If the replacement also fails,
  stop as for a dead implementer. A reviewer's state is a pure function of the diff it is given, so a
  fresh one loses only the tokens already spent.
- **What "dead" means:**
  - **An error is dead immediately** — a `SendMessage` that returns an error.
  - **Silence is live for at least 20 minutes** since the agent was last launched or messaged. A
    thorough architecture review has been observed to take about that long and return a full,
    undegraded report — several times the duration of the other agents in the same run, and
    indistinguishable from a hang while it is happening. The expensive mistake is the short timeout:
    too long costs waiting; too short turns a slow reviewer into a stopped run and discards a report
    that was on its way. Do not shorten the window to save time.
  - **A late report** — arriving after the agent was treated as dead, after a replacement, or after
    `done` was written — is recorded in the report, never discarded. It does not reopen a decision the
    gate already made, but a human can act on it, including reopening the run by hand.
