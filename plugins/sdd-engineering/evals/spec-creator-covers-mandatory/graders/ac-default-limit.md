---
type: 'regex'
target: { source: file, path: specs/0002-paged-order-listing.md }
pattern: '\*\*AC-\d+\*\*(?=(?:(?!\*\*AC-|\n\n)[\s\S])*\b20\b)(?=(?:(?!\*\*AC-|\n\n)[\s\S])*(default|omit|absent|missing|without|\bno `?limit|not (carry|give|given|provide|provided|supply|supplied|set|include)))'
flags: 'i'
match: 'contains'
weight: 1
arm: 'both'
---
One AC item (it may wrap over several lines; it ends at the next **AC- or a blank line) states the default of 20 when limit is not given.
