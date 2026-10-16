---
type: 'llm'
focus: 'trace'
weight: 3
---
PASS only if all of these hold for the spec file the run created under specs/:
- acceptance criteria are numbered AC-1, AC-2, ... and written in EARS form ("When ...", "If ..., then ...", "The ... shall ...");
- it has a test plan that names every AC;
- its status is `draft`, not `approved`;
- it describes behaviour, not implementation: no file names under api/src, no function names, no layering decisions;
- the agent's report lists open questions or decisions for the user instead of silently inventing answers (for example who may cancel, whether a shipped order can be cancelled);
- the report says the write boundary is enforced by instruction, not by a hook.
FAIL if any one of these is missing.
