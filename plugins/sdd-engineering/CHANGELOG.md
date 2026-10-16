# Changelog

All notable changes to this plugin are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
