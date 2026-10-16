# Orders API — agent instructions

A small HTTP API for customer orders. Plain JavaScript (ES modules) on Node 22, no dependencies.

## Packages
| Dir | Role |
|---|---|
| `api/` | Orders HTTP API: domain model, use cases, in-memory repository, routes |

## Verify
Run from `api/`.

| Package | Typecheck | Lint | Tests |
|---|---|---|---|
| `api/` | `npm run typecheck` | `npm run lint` | `npm test` |

User-owned (agents must not run): `npm run test:integration` (needs a real database).

## Do not touch
- `api/db/migrations/**`: add a new migration, never edit an existing one.
- Lockfiles.

## Architecture
Onion layering, described in [docs/architecture.md](docs/architecture.md). The dependency rule there is
mandatory for every change under `api/src/`.

## Specs
One spec per feature in `specs/`, format in [specs/README.md](specs/README.md).
