# onion-architecture — examples

Illustrative before/after pairs in a TypeScript backend (an `orders` feature, a Fastify-style router,
a Drizzle-style query builder). `❌` marks a shape that violates a rule; `✅` marks the reference
shape. Names and paths are examples — map them to the target project via SKILL.md §11.

---

## 1. `routes.ts` is transport only

❌ A handler that owns the query, the sync and the business logic:

```ts
import { and, eq } from 'drizzle-orm';
import * as t from '../../db/schema.js';

app.get('/customers/:id/orders', { schema: { params: IdParams } }, async (req) => {
  const { tenantId } = await getContext(container, req);
  const [customer] = await container.db
    .select()
    .from(t.customers)
    .where(and(eq(t.customers.tenantId, tenantId), eq(t.customers.id, req.params.id)));
  if (!customer) throw new NotFoundError('Customer not found');

  const remote = await billing.listInvoices({ customerId: customer.externalId });
  for (const inv of remote) {
    await container.db.insert(t.invoices).values({ … }).onConflictDoUpdate({ … });
  }
  // …many more queries, a backfill and two rollups
});
```

✅ The whole file is parse → context → service → status:

```ts
export default async function ordersRoutes(appBase: FastifyInstance) {
  const app = appBase.withTypeProvider<ZodTypeProvider>();
  const service = new OrderService(app.container);

  app.post('/orders', { schema: { body: OrderInput } }, async (req, reply) => {
    const { tenantId, userId } = await getContext(app.container, req);
    const { order, created } = await service.place(tenantId, userId, req.body);
    reply.status(created ? 201 : 200);
    return order;
  });

  app.get('/orders', async (req) => {
    const { tenantId } = await getContext(app.container, req);
    return service.list(tenantId);
  });
}
```

**Rule:** a route parses, resolves context, calls one service method, and maps the status code.

---

## 2. Services reach external systems through the container

✅ Git and secrets both arrive as ports; no SDK import anywhere:

```ts
async runMirrorJob(payload: MirrorJobPayload): Promise<void> {
  const token = await this.container.secrets.get(GIT_TOKEN_SECRET);
  const url = token ? withToken(payload.url, token) : payload.url;
  const { path } = await this.container.git.clone(url, { depth: CLONE_DEPTH });
  await this.repo.updateMirrorPath(payload.id, path);
}
```

❌ The shape to avoid — importing the library directly, which removes the test seam:

```ts
import simpleGit from 'simple-git';                 // ring 3 importing a vendor SDK
const git = simpleGit(workDir);
await git.clone(url, dest);
```

The same happens when a parser or queue library is imported straight into a service and a pipeline:
no test can substitute it.

**Rule:** if there is no port, add one (SKILL.md §6) rather than importing the library.

---

## 3. Only the data layer imports the ORM

✅ `modules/orders/repository/line.repo.ts` — free functions taking `db` first:

```ts
export async function insertLines(db: Db, orderId: string, lines: OrderLine[]): Promise<LineRow[]> {
  return db.insert(t.orderLines).values(lines.map((l) => ({
    orderId, sku: l.sku, quantity: l.quantity, … }))).returning();
}
```

✅ `modules/orders/repository.ts` composes them behind one facade, so services see a single object:

```ts
import * as lineRepo from './repository/line.repo.js';
import * as orderRepo from './repository/order.repo.js';

export class OrderRepository {
  constructor(private db: Db) {}
  getOrder(tenantId: string, id: string) { return orderRepo.getOrder(this.db, tenantId, id); }
}
```

**Rule:** the ORM appears in `repository.ts` and `repository/*.repo.ts`. Nowhere else in a module.

---

## 4. Mapping happens once

✅ The repository returns rows, the service maps them through one mapper module:

```ts
async list(tenantId: string): Promise<Order[]> {
  const rows = await this.repo.list(tenantId);
  return rows.map(toOrderDto);
}
```

❌ Mapping inside a repository as well, so the same module now has two answers to "where does row →
DTO happen":

```ts
export async function listOrdersForCustomer(db, tenantId, customerId): Promise<OrderSummary[]> {
  return rows.map(({ order, customerName }) => ({
    order_id: order.id, customer_name: customerName ?? null,
    total_cents: order.totalCents, … }));
}
```

**Rule:** repositories return ORM-inferred rows; one mapper module converts to the API contract.

---

## 5. Pure logic is a free function

✅ The file header states the reason:

```ts
/** Order rollup helpers (pure — no DB / `this`, so they unit-test cleanly). */
export function rollupStatuses(rows: { status: string; n?: number }[]): StatusCounts {
  const c: StatusCounts = { OPEN: 0, PAID: 0, CANCELLED: 0 };
  for (const r of rows) {
    if (r.status === 'OPEN' || r.status === 'PAID' || r.status === 'CANCELLED') {
      c[r.status] += r.n ?? 1;
    }
  }
  return c;
}
```

❌ The consequence of not doing this — a test has to fake a container and then reach through the
class to replace a private field, because the service constructs its own repository:

```ts
const container = { config: { … }, db: {} as never, … } as never;
const svc = new OrderService(container);
(svc as unknown as { repo: Record<string, unknown> }).repo = { getOrder: async () => null };
```

**Rule:** logic that needs a unit test goes in ring 1 as a free function — not behind a constructor.

---

## 6. Inner rings never import outward

❌ Ring 4 infrastructure importing a feature module:

```ts
// adapters/parser/index.ts
import { MAX_SIGNATURE_CHARS, SUPPORTED_EXT } from '../../modules/search/constants.js';
```

✅ The fix: the constants move into the adapter (it owns the parsing limits), or into the port file
if both sides need them. A neutral `db/rows.ts` solves the analogous problem for row shapes — so
cross-cutting consumers can reference a row shape without importing another module's data layer.

**Rule:** `adapters/**` and shared platform code must not import `modules/**`.

---

## 7. Adding an external system — all five steps

✅ The compact, correct version:

```ts
// 1. Port — declared beside the adapter for a narrow internal dependency
export interface DepGraph { … }

// 2. Adapter — the only file importing the library
export class CruiserDepGraph implements DepGraph { … }

// 3. Fake — deterministic, no network (in the project's test fakes)

// 4. Container — lazy getter + an overrides key
get depgraph(): DepGraph {
  if (this.overrides.depgraph) return this.overrides.depgraph;
  this._depgraph ??= new CruiserDepGraph();
  return this._depgraph;
}

// 5. Consume — services use container.depgraph; tests inject via overrides
```

Make the getter `async` only when the client needs a secret first — for example a payment client
that resolves an API key and throws a configuration error when it is missing.

**Rule:** skip a step and the system becomes untestable.

---

## 8. Transactions stay in the application ring

❌ Deleting from two tables with no transaction, so a failure between them leaves orphaned rows:

```ts
await db.delete(t.orderLines).where(eq(t.orderLines.orderId, orderId));
await db.delete(t.orders).where(eq(t.orders.id, orderId));
```

✅ The service owns the boundary, repositories accept an invoker:

```ts
// service.ts
await this.db.transaction(async (tx) => {
  await deleteOrderLines(tx, orderId);
  await deleteOrder(tx, orderId);
});

// repository/order.repo.ts
export async function deleteOrder(db: Db | Tx, orderId: string) {
  await db.delete(t.orders).where(eq(t.orders.id, orderId));
}
```

**Rule:** the transaction boundary is a use-case concern. It never appears in `routes.ts`.
