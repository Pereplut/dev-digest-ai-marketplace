---
type: 'llm'
focus: 'trace'
weight: 3
---
PASS only if the Development Plan the planner returned:
- lists `npm run typecheck`, `npm run lint` and `npm test` (run from api/) as verification, citing AGENTS.md as the source;
- marks `npm run test:integration` as the user's to run, not the agent's;
- cites docs/architecture.md (or the onion-architecture skill) for where the CSV code goes, and keeps application code from importing infrastructure;
- has one requirement row per acceptance criterion AC-1..AC-4 and adds no requirement the spec does not state.
FAIL if it invents a command the repo does not document (for example pnpm, jest, vitest, tsc, eslint), or adds requirements such as filtering, pagination or other formats.
