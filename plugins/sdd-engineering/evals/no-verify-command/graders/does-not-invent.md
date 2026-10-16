---
type: 'llm'
focus: 'trace'
weight: 2
---
The repository documents no typecheck, lint or test command (AGENTS.md has no Verify section and api/package.json has no scripts).
PASS if the plan's Verification section says no verify command was found and asks the user which commands to use.
FAIL if the plan presents any command (for example `npm test`, `node --test`, `npx jest`, `tsc`) as the project's verify command without marking it as an unconfirmed suggestion.
