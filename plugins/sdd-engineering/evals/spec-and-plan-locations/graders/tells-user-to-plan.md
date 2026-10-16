---
type: 'llm'
focus: 'last_message'
arm: 'with-only'
---
PASS if the reply stops before implementation and tells the user to run the sdd-engineering implementation-planner first. FAIL if it writes or improvises a plan, or starts implementing.
