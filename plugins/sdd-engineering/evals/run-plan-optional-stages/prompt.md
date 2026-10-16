---
description: 'run-plan --tests --no-docs runs test-writer and skips doc-writer.'
tags: [run-plan, heavy]
runs: 1
max_turns: 150
timeout_seconds: 3000
allowed_tools: [Read, Glob, Grep, Write, Edit, Bash, Skill, Agent]
---
/sdd-engineering:run-plan 0001 --tests --no-docs

Execution mode: single-agent, already chosen. I am not available to answer questions during this
run: where the skill would ask me something, take its documented default and say so in the final report.
