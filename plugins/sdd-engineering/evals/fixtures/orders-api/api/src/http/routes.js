// Composition root: the only place infrastructure is wired into use cases.
import { listOrders } from '../application/list-orders.js';
import { memoryOrdersRepo } from '../infrastructure/memory-orders-repo.js';

export function routes(repo = memoryOrdersRepo()) {
  return {
    'GET /orders': async () => ({ status: 200, headers: { 'content-type': 'application/json' }, body: JSON.stringify(await listOrders(repo)) }),
  };
}
