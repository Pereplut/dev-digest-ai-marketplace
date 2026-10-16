# Development Plan: Orders CSV export (specs/0001-orders-csv-export.md)

## Requirements review
| ID | Requirement, restated in one sentence | Source | Verdict | Satisfied by |
|---|---|---|---|---|
| R1 | `GET /orders/export.csv` returns 200 with `text/csv` | AC-1 | clear | step 3 |
| R2 | Header `id,customer,total,status`, then one row per order in id order | AC-2 | clear | steps 1, 2 |
| R3 | RFC 4180 quoting for commas, quotes, newlines | AC-3 | clear | step 1 |
| R4 | No orders: header row only | AC-4 | clear | step 2 |

## Scope
| Package | What changes | Why |
|---|---|---|
| `api/` | CSV formatter, export use case, route | AC-1..AC-4 |

## Constraints
| Constraint | Source (`path:line`) | How this plan honors it |
|---|---|---|
| Application never imports infrastructure | `docs/architecture.md:12` | the use case takes the repo as an argument |
| `routes.js` is the only composition root | `docs/architecture.md:14` | wiring stays in `routes.js` |
| Do not edit existing migrations | `AGENTS.md:20` | no schema change |

## Steps
1. CSV formatter with RFC 4180 quoting — `api/src/domain/csv.js` · domain · skill: `engineering-paved-path:onion-architecture` · test: `api/test/csv.test.js` asserts header, two rows, and `Smith, "Jo"` quoted as `"Smith, ""Jo"""` · satisfies: R2, R3
2. Export use case — `api/src/application/export-orders-csv.js` (takes `repo`) · application · test: `api/test/export-orders-csv.test.js` asserts id order and header-only for an empty repo · satisfies: R2, R4
3. Route `GET /orders/export.csv` — `api/src/http/routes.js` · http · test: `api/test/routes.test.js` asserts status 200 and `content-type: text/csv` · satisfies: R1

## Skills for the implementer
| Path (glob) | Skills | What they will require here |
|---|---|---|
| `api/src/**` | `engineering-paved-path:onion-architecture` | ring placement and the dependency rule (inferred from skill descriptions) |

## Verification
| Package | Command | What counts as pass |
|---|---|---|
| `api/` | `npm run typecheck` | exit 0 |
| `api/` | `npm run lint` | exit 0 |
| `api/` | `npm test` | all tests pass |
| `api/` | `npm run test:integration` | user-owned: the user runs it |

## Recommendations
none

## Clarification needed
**Blocked:** nothing
none

## Out of scope
| Not in this plan | Why | Who owns it |
|---|---|---|
| Architecture and security review | separate passes | `run-plan` reviewers |

## Not found
| Looked for | How (verbatim command) | Conclusion | What would settle it |
|---|---|---|---|
| An HTTP server entry point | `grep -rn "createServer" api/src` | none; routes are plain handlers | not needed for this spec |

## Execution mode
**Recommendation:** single-agent — three sequential steps in one package.

**Multi-agent decomposition**
| Wave | Agent | Steps | Runs in parallel with | Handoff artifact |
|---|---|---|---|---|
| 1 | implementer | 1-3 | — | diff |
| 2 | plan-verifier | gate | — | matrix |
| 3 | architecture-reviewer, correctness review | review | each other | findings |

**Single-agent decomposition**
Steps 1, 2, 3 in order; load `engineering-paved-path:onion-architecture` before step 1.

**Cost of the mode I recommend:** one implementer context.

**This is a recommendation, not a choice.** The main session must put it to the user with
`AskUserQuestion` before implementation starts.
