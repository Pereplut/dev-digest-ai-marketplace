# Plugin guidelines

The editorial rules behind [CONTRIBUTING.md](../CONTRIBUTING.md): what belongs in a plugin, and how to
write components that work in any repository.

## What goes where

| Group | Examples | Where it lives |
|---|---|---|
| Reusable | skills, agents, evals with no product-specific paths | a plugin in this marketplace |
| Project-specific | a product's CLAUDE.md / AGENTS.md, specs, module names, its do-not-touch list | the product repository, never here |
| Optional integration | MCP servers, anything with network access or credentials | a separate plugin, documented in SECURITY terms (none in 1.x) |
| Local leftovers | caches, personal memory, journals, experiments, absolute paths | nowhere — gitignore them |

For every file in a plugin, you should be able to say who owns it, which consumer scenario uses it,
and why it is versioned together with the rest of that plugin.

## Writing a project-agnostic component

1. **Ask the repository instead of assuming.** An agent reads the target repo's `AGENTS.md` /
   `CLAUDE.md` (root and package level) and `docs/` for verify commands, protected paths,
   naming and architecture rules, and cites what it used.
2. **Name the fallback.** If the fact is missing (no test command, no spec directory), the
   component says so and asks. It never invents a command.
3. **Document the artefacts.** Every file the workflow writes has a documented path in the plugin
   README (`specs/NNNN-*.md`, `.sdd/<spec-id>.plan.md`, `.sdd/retro/`, `WORKFLOW-RETRO.md`).
4. **One source per rule.** Detail lives in a skill or its `references/`. Agents point to it and
   do not restate it. Duplicated instructions cost context on every run and drift apart.
5. **Least privilege.** Read-only agents disallow `Write` and `Edit`. Give `Skill` to agents that
   must load a rule skill instead of reading its file by path.
6. **Namespaced references.** Use `<plugin>:<name>` for any agent or skill outside the current
   file, including the plugin's own components when the field expects a plugin-scoped name.
7. **Manual-only for side effects.** Orchestrators and retrospectives (`run-plan`,
   `workflow-retro`) set `disable-model-invocation: true`.

## Keep the paved path small

`engineering-paved-path` holds only skills that a shipped agent actually uses, or that have another
named consumer. Every skill adds to the discovery context of every session that installs the
plugin. Propose a new skill together with the consumer that needs it.

## Evals

Schema validation checks the shape of the files. Behaviour evals check that the composition does the
right work. A plugin that changes behaviour needs both. Use the `claude plugin eval` layout
(`evals/<case>/prompt.md` + `graders/`). Add a negative case whenever you widen a trigger
description, so the component does not fire on unrelated requests.
