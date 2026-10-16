---
type: 'llm'
focus: 'trace'
weight: 2
---
PASS if the planner stops without producing a Development Plan (no numbered Steps), says the spec is `draft`, and says the user has to approve it before planning.
FAIL if it plans anyway, or if anything sets the spec to `approved`.
