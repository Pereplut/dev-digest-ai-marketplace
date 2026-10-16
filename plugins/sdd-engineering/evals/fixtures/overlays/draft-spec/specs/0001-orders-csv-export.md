---
id: 0001
title: Orders CSV export
status: draft
owner: "@orders-team"
created: 2026-10-01
---

# Orders CSV export

## Problem
Support staff copy orders into spreadsheets by hand. They need a file they can open directly.

## Goals
- Download every order as CSV from one endpoint.

## Non-goals
- Filtering, pagination, other formats.

## Acceptance criteria (EARS)
- **AC-1** When a client requests `GET /orders/export.csv`, the API shall respond with status 200 and content type `text/csv`.
- **AC-2** The CSV shall start with the header row `id,customer,total,status`, followed by one row per order in id order.
- **AC-3** If a field contains a comma, a double quote or a newline, the API shall quote it and double any embedded quotes (RFC 4180).
- **AC-4** When there are no orders, the API shall respond with the header row only.

## Edge cases
- Customer names with commas or quotes (AC-3).
- Empty repository (AC-4).

## Decisions
- No streaming: the order count is small.

## Test plan
| ID | How it is tested |
|---|---|
| AC-1 | Unit test of the route handler: status and content type |
| AC-2 | Unit test of the CSV formatter with two orders |
| AC-3 | Unit test with a customer named `Smith, "Jo"` |
| AC-4 | Unit test with an empty repository |

## Phases
| Phase | Date | Notes |
|---|---|---|
| Planning | 2026-10-01 | Draft, awaiting review |
