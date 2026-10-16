---
name: engineering-insights
description: >-
  Records practical findings from a coding session (non-obvious dependencies, verified fixes,
  measured facts, odd findings, tool quirks, model behaviour) into the INSIGHTS.md nearest to the
  code the agent worked in, each with a date and file:line evidence, and reads the entries that bear
  on a task before it starts. Use after every code task as a wrap-up, as soon as a finding is
  confirmed mid-task, before starting work in an area that has INSIGHTS.md files, and when the user
  says "wrap up", "capture insights" or "what did we learn". Writes nothing when there is nothing new.
---

# Engineering insights

After each code task, the agent turns what it learned into short notes the next session reads before
it starts. Each module keeps its own append-only `INSIGHTS.md`; every entry carries a date and
`file:line` proof.

**No `INSIGHTS.md` anywhere in the repository?** Skip every step below silently: do not create one
unprompted.

## Where the files are

Discover them; never assume a fixed module list.

- **All files:** every `**/INSIGHTS.md` in the repository (plus any `INSIGHTS-<tag>.md` split of
  one), excluding dependency, build and vendored directories (`node_modules/`, `dist/`, `build/`,
  `vendor/`, `.git/`).
- **The file for a path:** the `INSIGHTS.md` in the nearest ancestor directory of that path, walking up
  towards the repository root.
- **Cross-cutting findings** (several modules, shared contracts, scripts, CI, tooling, agent
  configuration) go in the root `INSIGHTS.md`.

## When to run

1. **Read — before working in an area.** Route the entries instead of reading every file:

   ```
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/insights_for.py --root . <paths you will touch>
   python3 ${CLAUDE_PLUGIN_ROOT}/scripts/insights_for.py --root . --base <git-ref>
   ```

   It prints the entries whose `**Evidence:**` cites those paths, with `file:start-end` so you can
   read just those, plus the **title of every entry it routed away**. Skim those titles: routing is
   by cited path, so a universal lesson that happens to cite one file is under-routed. Entries marked
   `**Applies:** always` are returned regardless. Pass the paths of the step you are on; a
   whole-branch diff filters almost nothing. Reading never writes. Treat entries as high-confidence
   guidance unless the code now says otherwise.
2. **Capture as you go** — the moment a finding is *confirmed* (fix verified, behaviour reproduced,
   number measured). Do not write a guess; wait for the proof.
3. **Wrap-up — after every code task.** Before reporting a code task as done, review what it involved
   and record the findings that pass the quality bar (usually 0–3). Do it yourself; do not wait to be
   asked.

## No news, no write

If nothing passes the quality bar, **do not modify any `INSIGHTS.md`**: no "nothing learned" entry,
no session log, no reformatting. Zero entries is the expected outcome for most tasks; trivial ones
(typo fixes, pure renames, docs-only edits) never produce any.

## What to record

| Tag | Finding | Record things like |
|---|---|---|
| `dep` | Non-obvious dependency | Hidden coupling between files, modules or packages; things that must change together; boot or ordering requirements; an alias or config one package silently relies on |
| `fix` | Fix | Root cause of a failure plus the fix that was verified; recurring errors; silent failures and how they were exposed |
| `measured` | Measured fact | A number you actually measured (timing, size, limit, token count, row count, test duration) and how you measured it |
| `odd` | Odd finding | Surprising behaviour that is not (yet) a bug: drifted copies, dead paths, something that works for the wrong reason |
| `tool` | Library or tool quirk | Surprising behaviour of a framework, ORM, test runner, package manager, container tool, git, CI or the coding agent itself; version-specific pitfalls |
| `llm` | Model behaviour | Prompt or model behaviour, token or cost limits, output-parsing failures, quality findings for any feature that calls a model |

Not recorded here: architecture preferences, style, plans. Decisions go in the project's ADRs (often
`docs/adr/`), planned work in specs. Findings about how a multi-agent run was orchestrated go to
`sdd-engineering:workflow-retro`, not here.

## Where to write

Write in the `INSIGHTS.md` nearest to the code the finding is **about** (see *Where the files are*).
If you edited one module but found a quirk in another, write it in that other module's file. Write
each finding once; if it spans modules, use the root file. If the right module has no `INSIGHTS.md`
but the root does, use the root file rather than creating a new one; propose a new module file to the
user when a module accumulates several root entries.

## Entry format

Append at the bottom of the file:

```markdown
### YYYY-MM-DD — [tag] Short, searchable title
**Context:** what you were doing / what broke (one line).
**Insight:** the finding, stated as a fact.
**Apply:** what to do (or never do) next time.
**Evidence:** `path/to/file.ts:42` — plus the command, error, or measurement if relevant.
```

- **Date:** today's absolute date (`YYYY-MM-DD`), never "today" or "yesterday".
- **Evidence is mandatory and must include at least one `path:line`** (or `path:start-end`) relative
  to the repository root, pointing at the code or config the finding is about. For environment or
  tool facts, cite the line where it bites (the script, workflow or config that depends on it). No
  `file:line`, no entry — the routing script reads these citations to decide who sees the entry.
- **`**Applies:** always`** (optional line) — only for a lesson that applies to every task whatever
  path it touches. Use it sparingly; it bypasses routing.
- Keep each entry to six lines or fewer.

## Quality bar

Before writing, the entry must pass all five checks:

1. **Not obvious** — would someone reading the code, README or error message already know it? Then do
   not write it.
2. **Practical** — an agent with no memory of this session can act on it without re-investigating.
3. **Specific** — names the file, function, library, version, limit or number.
4. **Verified** — backed by a reproduced failure, a confirmed fix, or a measurement.
5. **Located** — has a real `file:line` that exists now.

| Vague (reject) | Useful (accept) |
|---|---|
| "Be careful with migrations." | "[dep] The API never migrates on boot; the generate command only writes SQL — run the migrate command after touching `api/src/db/schema/`." |
| "The model sometimes returns bad JSON." | "[llm] The model wraps JSON in code fences when the input contains markdown; strip fences before parsing in `api/src/review/parse.ts`." |
| "Indexing is slow." | "[measured] Indexing a 4k-file repository takes ~90 s, 80% in the parser; measured with `time` around the index job." |

"Don't do X" entries (failed approaches) are often the most valuable — record them.

## Procedure

1. Pick the target file with the rules above and **read it**.
2. **Dedupe:** if an existing entry covers the same fact, do not add a new one. If it is incomplete,
   append a short follow-up entry that links it (`Extends: "<original title>"`).
3. **Contradictions:** never edit or delete old entries. Append a new entry with
   `Supersedes: "<original title>"` explaining what changed. *Exception:* a legacy entry missing its
   `[tag]` or `**Evidence:**` line may get those added in place, without rewording.
4. Append the new entries at the bottom, in the format above.
5. If a file has grown past ~200 entries, tell the user and propose splitting it by tag (for example
   `INSIGHTS-llm.md`); do not split without asking.
6. Report in one short list what you recorded and where (or "no insights worth recording"), so the
   user can check it. These entries are drafts; the human reviews them in the diff.
