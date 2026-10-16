import { addMarketplaceCommand, installCommand, marketplaceName } from '../lib/commands';
import { href } from '../lib/router';
import { Command, useCatalog } from '../components/ui';

export function GettingStarted() {
  const { catalog, channel } = useCatalog();
  const { index } = catalog;
  const mp = marketplaceName(index, channel);
  const main = index.plugins.at(-1)?.name ?? index.plugins[0].name;
  const latest = index.marketplace.name;
  const stable = marketplaceName(index, 'stable');
  return (
    <div className="steps">
      <h1>Getting started</h1>
      <p className="lede">
        Commands for the <strong>{channel}</strong> channel; switch channels at the top of the page.
        {channel === 'latest'
          ? ' Latest follows main: you get each release as soon as it is merged.'
          : ' Stable pins each plugin to a release tag the maintainers promoted, and is where rollbacks happen.'}
      </p>

      <section>
        <h2>1. Add the marketplace</h2>
        <Command text={addMarketplaceCommand(index, channel)} />
        <p className="muted small">Add <code>--scope project</code> to the CLI form (<code>claude plugin marketplace add …</code>) to share it through the repo's <code>.claude/settings.json</code>. For a whole team, use the <a href={href('team-setup')}>team setup builder</a>.</p>
      </section>

      <section>
        <h2>2. Install a plugin</h2>
        <Command text={installCommand(index, main, channel)} />
        <p className="muted small">Dependencies are installed with it. Then load it into the running session:</p>
        <Command text="/reload-plugins" />
      </section>

      <section>
        <h2>3. Check it</h2>
        <Command text="claude plugin list --json" />
        <p className="muted small">No entry should report <code>dependency-unsatisfied</code> or <code>dependency-version-unsatisfied</code>. Skills appear as <code>/{main}:&lt;skill&gt;</code>, agents as <code>@agent-{main}:&lt;agent&gt;</code>.</p>
      </section>

      <section>
        <h2>4. Update</h2>
        <Command text={`/plugin marketplace update ${mp}`} />
        <Command text={`claude plugin update ${main}@${mp}`} />
        <p className="muted small">A plugin only updates when its version changes; maintainers bump it with every release.</p>
      </section>

      <section>
        <h2>5. Roll back</h2>
        <p>
          Releases are never re-tagged. When a release misbehaves, maintainers repoint the stable channel to
          the previous tag. To move to it from latest:
        </p>
        <Command text={`claude plugin uninstall ${main}@${latest}`} />
        <Command text={addMarketplaceCommand(index, 'stable')} />
        <Command text={installCommand(index, main, 'stable')} />
        <Command text="/reload-plugins" />
        <p className="muted small">
          Already on stable? Run <code>/plugin marketplace update {stable}</code> and <code>claude plugin update {main}@{stable}</code> after the maintainers' rollback lands.
          Details: <a href={`https://github.com/${index.marketplace.repo}/blob/main/docs/RELEASES.md`} target="_blank" rel="noopener noreferrer">docs/RELEASES.md</a>.
        </p>
      </section>
    </div>
  );
}
