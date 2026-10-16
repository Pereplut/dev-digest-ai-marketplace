---
description: 'spec-creator writes one draft spec under specs/, in EARS form, reports open questions and its prompt-only write boundary, and writes no code or plan.'
tags: [spec, behaviour]
runs: 3
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Skill, Agent]
---
Use the sdd-engineering spec-creator agent to write a spec for this feature:

Support staff need to cancel an order through the API. A cancelled order must keep its row in the
CSV export but show status `cancelled`. There are no mockups for this.

Save it as `specs/0002-order-cancellation.md`. Only the spec, please. Do not plan or implement anything.
