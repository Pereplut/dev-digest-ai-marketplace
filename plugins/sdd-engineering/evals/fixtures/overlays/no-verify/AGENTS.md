# Orders API — agent instructions

A small HTTP API for customer orders. Plain JavaScript (ES modules) on Node 22.

## Packages
| Dir | Role |
|---|---|
| `api/` | Orders HTTP API: domain model, use cases, in-memory repository, routes |

## Architecture
Onion layering, described in [docs/architecture.md](docs/architecture.md).

## Specs
One spec per feature in `specs/`, format in [specs/README.md](specs/README.md).
