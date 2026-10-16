---
description: 'The planner refuses to plan against a draft spec and leaves it unchanged; only the user approves.'
tags: [plan, negative]
runs: 3
max_turns: 25
timeout_seconds: 600
allowed_tools: [Read, Glob, Grep, Skill, Agent]
---
Use the sdd-engineering implementation-planner agent to plan specs/0001-orders-csv-export.md.
