# Commit points and the clean-tree invariant

Every commit `run-plan` makes is one of exactly four named instances of one rule, never an ad hoc
decision inside a stage.

## The invariant

IF the working tree has changes, `run-plan` commits **before launching or resuming any reviewer** —
`plan-verifier`, `architecture-reviewer`, `/code-review` or `test-writer`, with no exception.
`implementer` does not commit its own work, so nothing else closes that gap.

"Has changes" and "commit" both exclude the `.sdd/` working directory, where plans and retro journals
live, so bookkeeping never shows up in a reviewed diff:

```
git status --porcelain -- . ':(exclude).sdd'
git add -A -- . ':(exclude).sdd'
git commit -m "<message>" -m "<trailer from the session's instructions, if any>"
```

## The four commit points

1. **Stage 0** — the `status: in-progress` write, before any implementer is launched. Without it, that
   one-line change is the only thing in the tree when commit point 2 tests for changes, so "the
   implementer wrote nothing" would be indistinguishable from "it wrote nothing but the status line
   moved", and the empty-work stop below could never fire. Committing it here also places the line
   **before** the base sha, outside every range a reviewer sees.
2. **End of Stage 1, and end of each completeness round** — once every implementer for that round has
   returned, before launching or resuming `plan-verifier`.
3. **End of each fix round** — once that round's implementers have returned, before re-running any
   reviewer.
4. **End of Stage 5** — once the `status: done` write and `doc-writer` have both completed. **Only a
   run that reaches `done` gets this commit.** A stopped run's last commit is whichever point fired
   last, and that is correct: its incomplete state should stay visible in `git status`, not be swept
   into a tidy commit implying more was finished than was.

## Stop rules

- **Nothing to commit at commit point 2 is a loud stop.** Report that the implementer produced no
  change, and launch no reviewer that round. An empty diff must never be read as "everything was
  already correct": reviewers would diff nothing and return clean.
- **Nothing to commit at commit point 3 is not a stop.** It means no requested fix was made; the
  reviewers re-run over the unchanged commit, raise the same findings, and the fix-round cap bounds
  the loop. Reaching the cap and reporting those findings open is the honest result.
- **A declined commit prompt is a stop, at all four points.** Launch or resume no reviewer: it would be
  shown an empty or partial diff.

## Rules for every commit

- **Always `-m` with a real message.** A bare `git commit` opens an editor, which hangs the tool call;
  no sha comes back.
- **The trailer is read from the running session's instructions at commit time**, never hardcoded.
- **Never `--no-verify`**, on any git command.
- **Expect a permission prompt per commit** unless the user has allowed `git commit`. A clean run with
  two fix rounds expects five: Stage 0, Stage 1, one per fix round, and Stage 5. Each completeness round
  adds one. Say this up front, because an unexpected prompt is how people reach for a broad allowlist.
