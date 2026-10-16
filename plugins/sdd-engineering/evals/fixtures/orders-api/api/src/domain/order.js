export const STATUSES = ['pending', 'paid', 'shipped', 'cancelled'];

export function createOrder({ id, customer, total, status = 'pending' }) {
  if (!Number.isInteger(id) || id < 1) throw new Error('id must be a positive integer');
  if (!STATUSES.includes(status)) throw new Error(`unknown status ${status}`);
  return Object.freeze({ id, customer: String(customer), total: Number(total), status });
}
