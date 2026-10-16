---
type: 'regex'
target: { source: file, path: specs/0002-paged-order-listing.md }
pattern: '\*\*AC-\d+\*\*(?:(?!\*\*AC-|\n\n)[\s\S])*include_cancelled'
flags: ''
match: 'contains'
weight: 1
arm: 'both'
---
One AC item (it may wrap over several lines; it ends at the next **AC- or a blank line) covers include_cancelled.
