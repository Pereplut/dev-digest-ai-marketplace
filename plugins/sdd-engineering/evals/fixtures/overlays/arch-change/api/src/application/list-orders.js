// Use case. `repo` is a port: any object with `all()` returning orders.
import { memoryOrdersRepo } from '../infrastructure/memory-orders-repo.js';

export async function listOrders(repo = memoryOrdersRepo()) {
  const orders = await repo.all();
  return [...orders].sort((a, b) => a.id - b.id);
}

export async function exportOrdersCsv(repo = memoryOrdersRepo()) {
  const rows = (await listOrders(repo)).map((o) => [o.id, o.customer, o.total, o.status].join(','));
  return ['id,customer,total,status', ...rows].join('\n');
}
