import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listOrders } from '../src/application/list-orders.js';
import { memoryOrdersRepo } from '../src/infrastructure/memory-orders-repo.js';

test('lists orders in id order', async () => {
  const repo = memoryOrdersRepo([{ id: 2, customer: 'B', total: 5 }, { id: 1, customer: 'A', total: 3 }]);
  assert.deepEqual((await listOrders(repo)).map((o) => o.id), [1, 2]);
});
