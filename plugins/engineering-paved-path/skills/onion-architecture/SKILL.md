---
name: onion-architecture
description: >-
  Onion / ports-and-adapters rules for a backend — which ring a file belongs to, what each ring may
  import, and where external systems (ORM or query builder, HTTP and API clients, LLM SDKs, git
  libraries, parsers, queues) must sit behind a port. Use when adding or moving a backend module,
  route, service, repository or adapter; when wiring a new external system or SDK; when a route
  grows business logic or a DB query; when deciding where logic goes so it stays unit-testable
  without a database; or when reviewing backend layering. Trigger terms: onion architecture, ports
  and adapters, hexagonal, clean architecture, layering, boundaries, dependency rule, repository,
  adapter, DI container, composition root, service layer.
---

# Onion Architecture (backend)

**Placement and direction, not correctness.** This skill answers *"which ring does this belong to,
and what may it import?"* It does not judge route mechanics, query shape, contract shape or safety —
those belong to framework, ORM and schema skills, and to `engineering-paved-path:security`.

Rules are tagged for consuming agents:
- **CRITICAL** — breaks the dependency rule, or makes code untestable without a database
- **HIGH** — removes a test seam or leaks a vendor SDK inward
- **MEDIUM** — consistency and maintenance

Every rule traces to a source in [README.md](README.md). Before/after pairs are in
[examples.md](examples.md). Paths below are **illustrative** (`src/modules/orders/…`); map them to
the target project with the [Project overlay](#11-project-overlay) before applying anything.

---

## Quick lookup

| You are writing… | It goes… |
|---|---|
| An HTTP handler | `modules/<name>/routes.ts` (or controller) — parse, resolve request context, call the service, set status. Nothing else |
| A DB query | `modules/<name>/repository/<entity>.repo.ts`. The **only** place the ORM / query builder is imported |
| Orchestration across repository + adapter + job | `modules/<name>/service.ts` |
| A pure transform, rollup or derivation | A domain-named module in the feature (`modules/orders/pricing.ts`) as a **free function** — no `this`, no DB |
| Row → API DTO mapping | One mapper module per feature (`modules/orders/mappers.ts`) |
| A call to a third-party SDK | A new adapter in `adapters/<tech>/`, behind a port declared inward |
| A new external system | All five steps in [§6](#6-adding-a-new-external-system). No shortcuts |
| A row shape several modules need | A neutral shared module (`db/rows.ts`) — never import another module's repository |
| A literal, threshold or job kind | `modules/<name>/constants.ts` |

---

## 1. The dependency rule

> "All coupling is toward the centre." — Palermo
> "Source code dependencies can only point inwards." — Martin

In one sentence: **an outer ring may import an inner ring; an inner ring may never import an outer
one.** Everything below is a consequence.

| Ring | Contains (illustrative) | May import | Must never import |
|---|---|---|---|
| **1 — Domain core** | Pure domain logic: free functions, value types, a standalone engine package if the project has one | Shared contracts, stdlib | Anything outward; any SDK; the ORM |
| **2 — Ports & contracts** | Port interfaces (`ports.ts`, `core/ports/**`), shared schemas / DTO contracts | Ring 1 | Any implementation; any SDK; the ORM |
| **3 — Application services** | `modules/*/service.ts`, use-case orchestrators, job runners, pipelines | Rings 1–2, the composition root's container type, its own `repository/*` | Vendor SDKs (HTTP/API clients, LLM SDKs, git libraries, parsers), the ORM |
| **4 — Infrastructure & transport** | `modules/*/routes.ts`, `adapters/**`, `db/**`, app bootstrap, server entry | Everything inward | Another module's internals; `modules/**` from `adapters/**` or shared platform code |

The rings are **relaxed, not strict**: ring 4 may call ring 1 directly. A pass-through method that
only forwards to the next ring is a Middle Man smell, not architecture — delete it.

---

## 2. Ring 1 — Domain core

- **CRITICAL — the core takes no side effects.** No DB, no HTTP, no filesystem, no clock reads you
  cannot inject. The target shape: the only side effect is an injected port (for example an LLM or
  pricing provider passed in as an interface).
- **CRITICAL — domain logic belongs in the core, not in the transport or persistence layer.** The
  outer rings gather inputs and persist results. If the project re-exports core logic through thin
  shims in an outer ring, do not grow those shims.
- **HIGH — pure logic is a free function, not a method.** A file whose header says *"pure — no DB /
  `this`, so it unit-tests cleanly"* is the model. Anything reachable only through a service
  constructor is effectively untestable (see [§7](#7-testing-follows-the-rings)).

## 3. Ring 2 — Ports & contracts

- **CRITICAL — a port is an interface, never an implementation.** All external calls go behind
  these interfaces.
- **CRITICAL — ports import nothing outward.** Contracts are schemas and types only: no runtime
  logic, no imports from application or infrastructure code.
- **MEDIUM — an interface must earn its keep.** Add one only when it has more than one
  implementation, **or** it inverts a dependency to protect an inner ring, **or** it ships in a
  client library. A port with a real adapter *and* a test fake clears the bar. Do not add
  speculative interfaces for internal collaborators.

## 4. Ring 3 — Application services

- **CRITICAL — a service never imports a vendor SDK.** Reach external systems through the
  composition root (`container.git`, `container.secrets`, `await container.paymentClient()`). If no
  port exists, add one ([§6](#6-adding-a-new-external-system)) — do not import the library.
- **CRITICAL — a service never writes SQL.** Persistence goes through its repository. No HTTP and
  no raw SQL in a service: persistence through the repository, pure transforms through domain
  modules, literals through `constants.ts`.
- **HIGH — row → API DTO mapping happens once, in a mapper module.** `service.list()` is
  `rows.map(toOrderDto)`. Do not map inside repository functions as well — one module, one answer to
  "where does mapping happen".
- **MEDIUM — cross-module reuse goes through the container or a neutral shared module**, never by
  importing another module's `service.ts` or repository. Expose a shared repository on the container
  precisely so consuming modules do not reach into another module's folder.

## 5. Ring 4 — Infrastructure & transport

- **CRITICAL — `routes.ts` is transport only.** Parse → resolve context → call the service → set the
  status code. No ORM import, no schema-table import, no business logic. A reference route file is
  short: a handful of routes, zero logic.
- **CRITICAL — `adapters/**` and shared platform code must not import `modules/**`.** That is an
  inner ring depending on an outer one. Shared constants belong in the adapter, in the port, or in a
  neutral module.
- **HIGH — one adapter per external system, under `adapters/<tech>/`**, implementing its port, with
  timeouts/retries through a shared resilience helper and failures surfaced as one typed
  external-service error.
- **HIGH — route schemas come from the shared contracts.** Don't hand-roll `Schema.parse(req.body)`
  in a handler when the framework can validate from the declared schema.
- **MEDIUM — repositories may return ORM-inferred rows.** This is a deliberate deviation from Clean
  Architecture — see [§9](#9-deliberate-choices-where-sources-disagree).

---

## 6. Adding a new external system

All five steps, or the system is not integrated — it is smuggled in. The cautionary pattern: a
parser or queue library imported directly by a service and a pipeline, with no test seam, so no test
can substitute it.

1. **Port** — declare the interface inward (the shared ports file, or a module-local `types.ts` for
   an internal facade).
2. **Adapter** — implement it in `adapters/<tech>/index.ts`. This is the only file allowed to import
   the SDK.
3. **Fake** — add a deterministic implementation to the project's test fakes. No real network.
4. **Container** — add a lazy getter on the composition root, and the matching key to its
   overrides. Make the getter `async` only when the client needs a secret first.
5. **Consume** — services use `container.<thing>`. Tests inject through overrides.

A **degraded-mode contract** is strongly preferred where the system is optional: declare it on the
port (arrays → `[]`, objects → `{ degraded, reason }`) so callers never branch on absence. Leaving it
implicit is how optional context degrades silently with no error.

## 7. Testing follows the rings

- **HIGH — fake at the port, don't mock the module.** Avoid module-level mocking of application
  code (`vi.mock` / `jest.mock` of your own services). Substitute adapters through the container's
  overrides; the fakes exist for this.
- **HIGH — if logic needs a test, put it in ring 1.** When every service constructor does
  `new XRepository(container.db)`, a repository cannot be substituted from outside, and a service
  test ends up monkey-patching a private field — treat that as a warning, not a pattern. Extract the
  logic to a free function instead.
- **MEDIUM — separate DB-backed tests by name.** A test that needs a real database gets a
  distinguishing suffix or directory (for example `*.it.test.ts`); everything else stays hermetic.
  A smoke test that boots the whole app with no database is exactly Cockburn's stated goal — worth
  preserving.

## 8. Transactions

Multi-statement writes without a transaction are non-atomic: deleting child rows then the parent,
or a job runner performing several separate status updates, can leave orphans on failure.

When you need atomicity, keep the transaction in the **application** ring and pass it down; do not
let it leak into routes:

```ts
// service.ts — owns the boundary
await this.db.transaction(async (tx) => {
  await deleteOrderLines(tx, orderId);
  await deleteOrder(tx, orderId);
});

// repository/order.repo.ts — accepts an optional invoker
export async function deleteOrder(db: Db | Tx, orderId: string) { … }
```

The `tx ?? db` invoker shape is the standard TypeScript treatment; see README, *Stack-specific*.

---

## 9. Deliberate choices where sources disagree

| Question | This skill's default | Why, and when to deviate |
|---|---|---|
| **Do repositories return DB rows or domain entities?** | **Rows** (ORM-inferred types) | Martin says never pass database rows across a boundary. We overrule him: a separate persistence model can quadruple CRUD code for no gain at moderate domain complexity (Rentea). Revisit if module logic starts depending on row shape in more than one ring |
| **Interface for every collaborator?** | **No** | An interface earns existence with >1 impl, a dependency inversion protecting an inner ring, or a client library. Ports clear this; internal services don't |
| **Where do repositories live — domain or application?** | **Application** | Palermo puts repository *interfaces* in the core; Graça argues persistence is an application concern because *"the domain knows nothing about persistence."* We follow Graça: the port lives in ring 2, the implementation in ring 4 |
| **Strict or relaxed layers?** | **Relaxed** | A method that only forwards to the next layer is a Middle Man. Skipping a ring inward is fine; skipping outward never is |
| **Per-module layers, or flat vertical slices?** | **Layers, in modules with a service** | The module boundary already separates features (Jovanović), so layers are earned, not automatic — but shared entities across use cases make a dedicated data layer worth it |
| **DI container required?** | **No** | Palermo, four years on: onion *"works just fine without the likes of StructureMap."* A hand-rolled composition root is sufficient; use the one the project already has |

---

## 10. Enforcement

A convention without a linter is a suggestion. Prose alone does not hold: an unregistered module
with hardcoded secrets and string-concatenated SQL can pass typecheck, lint and the whole test suite
untouched.

| Rule | Tool |
|---|---|
| Ring direction, routes free of the ORM, no SDK in services, no cycles | dependency-cruiser `forbidden` rules |
| Same rules, in-editor while typing | ESLint `no-restricted-imports` zones |
| Anything an import graph can't express | ast-grep lint rules |
| Richer layer algebra, if zones outgrow the core rule | `eslint-plugin-boundaries` |

dependency-cruiser exits with the violation count, so CI gates for free. Two options are
load-bearing: `tsConfig` (without it TypeScript path aliases don't resolve and the ruleset silently
under-reports) and `tsPreCompilationDeps` (without it `import type { Container }` coupling is
invisible).

**A ruleset that never fails is the failure mode.** After changing it, drop one exclusion and
confirm the rule actually fires.

---

## 11. Project overlay

This skill is the generic doctrine. Before applying it to a real codebase, find the project's own
rules — **repo rules override the generic doctrine** wherever they differ:

- **Agent instructions** — `AGENTS.md` / `CLAUDE.md` at the root and in each backend package:
  module layout, naming, where ports, adapters, fakes and the composition root live.
- **Architecture docs** — `docs/`, ADRs (`docs/adr/`, `adr/`), package `README.md` architecture
  sections.
- **Boundary tool configs** — `.dependency-cruiser.cjs` / `.dependency-cruiser.js`, ESLint
  `no-restricted-imports` / `eslint-plugin-boundaries` zones, ast-grep `sgconfig.yml` rules. These
  are the executable form of the project's rings; their rule names and comments are the project's
  vocabulary.
- **Known deviations** — exclusions in those configs, usually commented, are grandfathered code.
  Do not copy them into new code, and hold new and touched code to the rule.
- **A reference module** — if the docs name one ("copy this shape"), use it as the template.

Cite the file you took each project rule from. If the project documents none of this, apply the
generic rules above and say so.

---

## Sources

Every rule traces to [README.md](README.md), with links and the consensus/contested split. Read it
before overriding anything here.

The four load-bearing ones: Palermo (the dependency rule), Cockburn (ports and adapters), Martin
(the Dependency Rule verbatim — and the one rule this skill knowingly relaxes), and Rentea (why the
relaxation is correct at moderate domain complexity).
