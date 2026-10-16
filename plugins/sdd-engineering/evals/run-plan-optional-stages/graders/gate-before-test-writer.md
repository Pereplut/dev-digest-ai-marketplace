---
type: 'tool_order'
before:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?plan-verifier"'
after:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?test-writer"'
arm: 'with-only'
---
