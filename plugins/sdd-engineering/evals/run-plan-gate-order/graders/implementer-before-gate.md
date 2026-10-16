---
type: 'tool_order'
before:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?implementer"'
after:
  tool: 'Agent'
  input_match: '"subagent_type"\s*:\s*"(?:[\w-]+:)?plan-verifier"'
arm: 'with-only'
weight: 2
---
