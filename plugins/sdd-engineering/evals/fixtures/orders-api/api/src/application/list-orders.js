// Use case. `repo` is a port: any object with `all()` returning orders.
export async function listOrders(repo) {
  const orders = await repo.all();
  return [...orders].sort((a, b) => a.id - b.id);
}
