---
type: 'regex'
target: 'trace'
pattern: 'Write boundary:[^\n]{0,160}(instruction|no hook)'
flags: 'i'
match: 'contains'
weight: 1
arm: 'both'
---
Spec 0001 AC-14: spec-creator's own report (in the trace, as the Agent tool result) states that its write
boundary is enforced by instruction, not by a hook. The parent session often drops that line when it
summarizes, so the final reply is the wrong place to look.
