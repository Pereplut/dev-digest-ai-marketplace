import { createOrder } from '../domain/order.js';

export function memoryOrdersRepo(seed = []) {
  const rows = seed.map(createOrder);
  return { all: async () => rows };
}
