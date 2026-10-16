---
type: 'regex'
pattern: '^status: (in-progress|done)$'
flags: 'm'
match: 'contains'
target:
  source: 'file'
  path: 'specs/0001-orders-csv-export.md'
arm: 'with-only'
---
