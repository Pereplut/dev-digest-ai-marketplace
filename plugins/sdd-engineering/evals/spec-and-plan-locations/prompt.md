---
description: 'run-plan with no saved plan stops at intake, names the derived plan path, never invents a plan and leaves the spec unchanged.'
tags: [run-plan, negative]
runs: 3
max_turns: 30
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Bash, Skill, Agent]
---
/sdd-engineering:run-plan 0001
