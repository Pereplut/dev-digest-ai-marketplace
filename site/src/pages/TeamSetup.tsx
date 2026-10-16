import { useMemo, useState } from 'react';
import { teamSettings, withDependencies } from '../lib/commands';
import { CopyButton, useCatalog } from '../components/ui';

export function TeamSetup() {
  const { catalog, channel } = useCatalog();
  const { index } = catalog;
  const [picked, setPicked] = useState<Set<string>>(() => new Set([index.plugins.at(-1)!.name]));
  const resolved = useMemo(() => withDependencies(index, picked), [index, picked]);
  const json = JSON.stringify(teamSettings(index, picked, channel), null, 2);
  const toggle = (name: string) => setPicked((s) => {
    const next = new Set(s);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    return next;
  });

  return (
    <>
      <h1>Team setup</h1>
      <p className="lede">
        Pick the plugins your team should have. Commit the block below to your repository's
        <code> .claude/settings.json</code>: teammates who trust the folder are prompted to add the
        marketplace and enable the plugins. Dependencies are added for you.
      </p>
      <div className="split">
        <fieldset className="panel picker">
          <legend>Plugins ({channel} channel)</legend>
          {index.plugins.map((p) => {
            const implied = !picked.has(p.name) && resolved.includes(p.name);
            return (
              <label key={p.name} className="check">
                <input type="checkbox" checked={picked.has(p.name) || implied} disabled={implied} onChange={() => toggle(p.name)} data-testid={`pick-${p.name}`} />
                <span>
                  <strong>{p.name}</strong>
                  {implied && <span className="muted small"> (required by your selection)</span>}
                  <br />
                  <span className="muted small">{p.summary}</span>
                </span>
              </label>
            );
          })}
        </fieldset>
        <div className="panel">
          <div className="panel-head">
            <h2>.claude/settings.json</h2>
            <CopyButton text={json} label="Copy JSON" testId="copy-settings" />
          </div>
          <pre className="code" data-testid="settings-json"><code>{json}</code></pre>
          <p className="muted small">
            Merge with existing keys rather than replacing the file. <code>enabledPlugins</code> is keyed
            <code> plugin@marketplace</code>.
          </p>
        </div>
      </div>
    </>
  );
}
