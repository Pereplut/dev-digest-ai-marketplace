---
type: 'tool_order'
before:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?plan-verifier"'
after:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?architecture-reviewer"'
arm: 'with-only'
weight: 2
---
