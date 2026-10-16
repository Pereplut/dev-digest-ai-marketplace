---
description: 'spec-creator turns each of four mandatory requirements into its own acceptance criterion and reports the coverage.'
tags: [spec, behaviour]
runs: 3
max_turns: 40
timeout_seconds: 900
allowed_tools: [Read, Glob, Grep, Write, Edit, Skill, Agent]
---
Use the sdd-engineering spec-creator agent to write a spec for paging the order list.

Clients of `GET /orders` need pages instead of the whole list. Requirements:

- A `limit` above 100 must be rejected with status 400.
- When `limit` is omitted it must default to 20.
- Every response must carry an `X-Total-Count` header with the total number of orders.
- Cancelled orders must be left out unless the request sets `include_cancelled=true`.

It would be nice to have a `next` link too, but that can wait.

Save it as `specs/0002-paged-order-listing.md`. Only the spec, please. Do not plan or implement anything.
