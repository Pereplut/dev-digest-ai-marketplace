import { href } from '../lib/router';
import { useCatalog } from '../components/ui';

export function Compatibility() {
  const { catalog } = useCatalog();
  const { index } = catalog;
  const rows = [...index.compatibility].sort((a, b) => a.plugin.localeCompare(b.plugin) || b.version.localeCompare(a.version, undefined, { numeric: true }));
  return (
    <>
      <h1>Compatibility</h1>
      <p className="lede">
        Minimum Claude Code version per plugin release, read from each release's <code>COMPATIBILITY.md</code>.
        Check yours with <code>claude --version</code>.
      </p>
      <div className="table-wrap">
        <table className="table" data-testid="compat">
          <thead><tr><th>Plugin</th><th>Version</th><th>Claude Code</th><th>Tested on</th><th>Source</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.plugin}@${r.version}`}>
                <td><a href={href('plugin', r.plugin)}>{r.plugin}</a></td>
                <td>{r.version}</td>
                <td>{r.minClaudeCode ? <code>&gt;= {r.minClaudeCode}</code> : <span className="muted">unknown</span>}</td>
                <td>{r.testedOn?.replace(/^Claude Code /, '') ?? '—'}</td>
                <td className="muted small">{r.source}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small">
        “working tree” means the version on main has no release tag yet; tagged rows are read from the file at that tag.
      </p>
    </>
  );
}
