# Changelog

All notable changes to this plugin are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this plugin
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).
How the releases below were cut, rehearsed and measured: the
[build report](https://claude.ai/artifact/C3uAY823HPG4uM1xUxLYb3).

## [1.0.0] - 2026-10-16

### Added
- `architecture-reviewer` agent: read-only layering review of changed lines against
  `engineering-paved-path` skills and repo-local boundary configs, with a built-in
  CRITICAL / WARNING / SUGGESTION rubric.
- Dependency on `engineering-paved-path@^1.0.0`.
