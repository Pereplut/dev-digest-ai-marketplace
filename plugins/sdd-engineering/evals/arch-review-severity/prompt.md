---
description: 'architecture-reviewer grades an application-to-infrastructure import as CRITICAL from the repo docs and paved-path rules, with evidence, and changes nothing.'
tags: [review, behaviour]
runs: 3
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Bash, Skill, Agent]
---
I have an uncommitted change in api/src/application/list-orders.js. Use the architecture-review architecture-reviewer agent to review it.
