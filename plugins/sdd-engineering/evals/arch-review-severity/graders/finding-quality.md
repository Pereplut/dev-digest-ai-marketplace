---
type: 'llm'
focus: 'trace'
weight: 3
---
The change makes api/src/application/list-orders.js import ../infrastructure/memory-orders-repo.js, which docs/architecture.md forbids.
PASS only if the review:
- reports that import as CRITICAL, citing api/src/application/list-orders.js with a line number;
- grounds the rule in docs/architecture.md or the engineering-paved-path onion-architecture skill;
- uses only the severities CRITICAL, WARNING and SUGGESTION;
- proposes no patch and edits nothing.
FAIL if the import is missed, graded below CRITICAL, or the reviewer rewrites the code.
