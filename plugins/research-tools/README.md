# research-tools

A read-only **researcher** agent for Claude Code. It answers "how does X work here", "where is X
implemented", "when and why did X change" (repo mode) and "what does upstream actually say about X"
(external mode), and returns a structured report: a direct answer, an evidence table with
`path:line` or verbatim quotes from fetched URLs, a confidence line, and a mandatory **Not found**
section that separates "this does not exist" from "nobody looked hard enough".

## Components

| Component | Type | Invocation | What it does |
|---|---|---|---|
| `researcher` | agent | `research-tools:researcher` (dispatched by Claude, or `@research-tools:researcher` / "use the researcher agent") | Repo and/or external research; read-only (`Write` and `Edit` disallowed); stops with a clarification report when the question is unbounded |

## Install

```
/plugin marketplace add Pereplut/dev-digest-ai-marketplace
/plugin install research-tools@dev-digest-ai-marketplace
```

No dependencies.

## Use

Ask for research and Claude dispatches the agent, or name it directly:

```
Use the research-tools:researcher agent: where is request authentication enforced, and since when?
```

Good moments to use it: before writing a spec or plan (to settle facts the document will assert),
before extending an area (it reports collision surfaces — names, routes, keys already in use), and
when an upstream library's behaviour or version matters.

## What it reads from the target repository

- source files and `git` history (`git log`, `git show`, `git blame`, `git diff`);
- agent instructions (`AGENTS.md` / `CLAUDE.md`, root and package-level) for conventions;
- specs (commonly `specs/` or `<pkg>/specs/`), `docs/` and ADRs;
- `INSIGHTS.md` files, if the repo keeps them — it greps them for the paths it is researching and
  reads only matching entries;
- package manifests and lockfiles, to pin the installed version of a library it researches.

## Recommended permission rules (optional)

Plugins cannot ship permissions. If you want external research fetches limited to trusted hosts and
inspection-only shell use, add rules like these to your project's `.claude/settings.json` and adapt
the domain list to your stack:

```json
{
  "permissions": {
    "allow": [
      "WebFetch(domain:code.claude.com)",
      "WebFetch(domain:docs.anthropic.com)",
      "WebFetch(domain:github.com)",
      "WebFetch(domain:raw.githubusercontent.com)",
      "WebFetch(domain:developer.mozilla.org)",
      "Bash(git log:*)",
      "Bash(git show:*)",
      "Bash(git blame:*)",
      "Bash(git diff:*)",
      "Bash(git ls-files:*)"
    ],
    "deny": [
      "Bash(find:*)",
      "Bash(rg:*)"
    ]
  }
}
```

When a fetch is refused, the agent records the URL in its **Not found** section instead of
answering from a search snippet or from memory.

## Limitations

- It cannot ask questions interactively; an ambiguous or unbounded task returns a
  `## Clarification needed` report with proposed defaults instead of findings.
- Budget is about 25 tool calls per run; larger questions come back partial, with the rest listed as
  inconclusive.
- It never edits, commits or implements anything.
