# Project facts — read them, never assume them

`run-plan` works in any repository, so every project-specific fact comes from the target repository
at runtime. Read, in this order, and stop reading a fact once it is settled:

1. Root `AGENTS.md` and `CLAUDE.md` (a `CLAUDE.md` that only imports `AGENTS.md` adds nothing).
2. Package-level `AGENTS.md` / `CLAUDE.md` for every package the plan's steps touch.
3. `docs/` pages those files point to (contributing guides, testing strategy, architecture).
4. Build manifests only to confirm a command exists (`package.json` scripts, `Makefile`,
   `pyproject.toml`), never as the sole source of a command the instructions do not mention.

**Record the source of every fact** (`AGENTS.md`, `api/AGENTS.md`, `docs/testing.md`) and include
that list in the Stage 0 output and the final report. A fact you could not find is written as not
found, never filled with a convention from another project.

## The facts

| Fact | What to look for | If absent |
|---|---|---|
| **Spec directory** | Where specs live (`specs/`, `docs/specs/`, package-level `<pkg>/specs/`). | `specs/` |
| **Package buckets** | A package or module table / list: each top-level directory with its own toolchain, owner or verify commands. A package nested inside another (shared contracts under a server package, for example) **folds into its outer package**: two implementers editing under one package would run its verify commands against each other's half-finished edits. Everything outside all packages (root config, scripts, CI, specs, agent config) is one **root** bucket. | One bucket: one implementer, always. |
| **Verify commands** | Typecheck, lint and test commands per package, and the directory each runs from. Cross-package rules ("a change to X also requires Y's tests"). | Report **"no verify command found"** and ask. Never invent one. |
| **User-owned commands** | Commands the instructions reserve for a human: slow, Docker-backed or flaky integration suites, end-to-end runs, manual checks, a pre-push or pre-PR review gate. | "no user-owned commands documented". |
| **Protected paths** | "Do not touch" lists: migrations, lockfiles, vendored or generated code, and any stated exceptions. | None beyond what git ignores. |
| **Commit trailer** | The authorship trailer the running session's instructions require for commits. | Commit without one. |

## How the facts are used

- **Verify commands** are run by `sdd-engineering:implementer`, which reads them itself; `run-plan`
  checks only that at least one exists, so a run never starts with nothing that can fail.
- **User-owned commands** are never run by `run-plan` or any agent it launches. They are named in every
  terminal report, and a plan step verified only by one is reported **implemented-but-unverified**.
- **Protected paths** make a finding `deferred` in triage, never `fix` (see the review loop).
- **Package buckets** decide whether Stage 1 may launch more than one implementer.
- **Commit trailer** is read at commit time, every time. Do not inline a literal trailer into any file:
  it names a model, and the model writing a file is rarely the one doing a later run's work.
