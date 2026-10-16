# Changelog

All notable changes to this plugin are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How the releases below were cut, rehearsed and measured: the
[build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3).

## [1.1.0] - 2026-10-16

### Added
- `spec-creator`: hard rule 6 and a *Requirement coverage* step. Every mandatory requirement in the
  request (must, shall, never, explicit limits, defaults, headers, status codes) is quoted and mapped
  to an `AC-N` or a clarification item before the agent reports. The report gains
  `## Requirement coverage`.
- `spec-authoring`: the template's required headings inline, for sessions that may not read files
  inside the installed plugin. `test/python/test_skill_headings.py` keeps the copy identical to the template.
- Eval `spec-creator-covers-mandatory` (11 cases now).
- README: an opt-in `Read(~/.claude/plugins/cache/dev-digest-ai-marketplace/**)` rule, so the
  agents can open the plugin's reference files without a prompt each time.

### Changed
- `spec-creator`: the `Write boundary:` line is now literal, not a placeholder, and a last check
  before replying confirms it. It was missing from about 4 in 9 reports on 1.0.0; 3 of 3 on 1.1.0.

### Fixed
- `check_specs.py` fails a `status: draft` spec, or a spec named on the command line, that lacks the
  `## Acceptance criteria (EARS)` heading. Before, such a spec was skipped and the checker exited 0.
  That happened installing 1.0.0 into a fresh repository: the template read was refused, the
  heading came out as `## Acceptance criteria`, and the spec passed without being checked. It also
  names every spec it skips.

## [1.0.0] - 2026-10-16

### Added
- Agents: `spec-creator`, `implementation-planner`, `implementer`, `plan-verifier`, `test-writer`,
  `doc-writer`.
- Skills: `run-plan` (manual orchestrator for implementation, verification, review and docs),
  `workflow-retro` (manual retrospective with `scripts/analyze_journals.py`),
  `engineering-insights`, `spec-authoring` (EARS and test-plan rules, spec template).
- Scripts: `check_specs.py` (spec structure checker), `insights_for.py` (routes `INSIGHTS.md`
  entries by touched paths).
- Behaviour evals (`evals/`, maintainers only): 10 `claude plugin eval` cases over a fixture repo,
  covering spec writing, planning from project facts, the run-plan gate order and optional stages,
  architecture severity, and negative cases (unrelated request, retro not automatic).
- Dependencies: `engineering-paved-path@^1.0.0`, `research-tools@^1.0.0`,
  `architecture-review@^1.0.0`.
