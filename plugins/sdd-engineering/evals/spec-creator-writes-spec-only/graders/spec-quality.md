---
type: 'llm'
focus: { source: file, path: specs/0002-order-cancellation.md }
weight: 2
---
Judge the spec file itself. PASS only if all of these hold:
- acceptance criteria are numbered AC-1, AC-2, ... and written in EARS form ("When ...", "If ..., then ...", "The ... shall ...");
- it has a test plan that names every AC;
- its status is `draft`, not `approved`;
- it describes behaviour, not implementation: it does not plan which files, functions or layers to create or change. Citing existing files as the provenance of an input (for example `[reused: api/src/domain/order.js]`) is required by the spec format and is not implementation.
FAIL if any one of these is missing, or if the file is empty or absent.
