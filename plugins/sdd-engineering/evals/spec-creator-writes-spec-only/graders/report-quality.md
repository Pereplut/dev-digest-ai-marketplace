---
type: 'llm'
focus: 'last_message'
weight: 1
arm: 'both'
---
Judge the final reply to the user. PASS if it lists open questions or decisions for the user (for example who may cancel, whether a shipped order can be cancelled) instead of silently inventing answers. FAIL if it presents those choices as settled.
