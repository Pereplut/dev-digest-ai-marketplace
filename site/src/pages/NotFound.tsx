export function NotFound({ what = 'page' }: { what?: string }) {
  return (
    <div className="empty">
      <h1>Not found</h1>
      <p>There is no {what} in this catalog. <a href="#/">Browse all plugins</a>.</p>
    </div>
  );
}
