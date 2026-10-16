// Copy-ready CLI strings. One place, so every page and the snippet builder agree (SITE-SPEC AC-5, AC-7).
import type { Channel, Index, PluginRow } from '../types';

export const STABLE_SUFFIX = '-stable';

export function marketplaceName(index: Index, channel: Channel): string {
  return channel === 'stable' ? index.channels.stable ?? `${index.marketplace.name}${STABLE_SUFFIX}` : index.marketplace.name;
}

/** The stable channel is a second marketplace file in the same repo, added by its raw URL. */
export function stableMarketplaceUrl(index: Index): string {
  return `https://raw.githubusercontent.com/${index.marketplace.repo}/main/channels/stable/.claude-plugin/marketplace.json`;
}

export function addMarketplaceCommand(index: Index, channel: Channel): string {
  return `/plugin marketplace add ${channel === 'stable' ? stableMarketplaceUrl(index) : index.marketplace.repo}`;
}

export function installCommand(index: Index, plugin: string, channel: Channel): string {
  return `/plugin install ${plugin}@${marketplaceName(index, channel)}`;
}

/** Version a user gets from a channel: the manifest on latest, the pinned tag on stable. */
export function channelVersion(plugin: PluginRow, channel: Channel): string | null {
  return channel === 'stable' ? plugin.stable?.version ?? null : plugin.version;
}

/** Selected plugins plus everything they depend on, transitively, in marketplace order. */
export function withDependencies(index: Index, selected: Iterable<string>): string[] {
  const byName = new Map(index.plugins.map((p) => [p.name, p]));
  const out = new Set<string>();
  const visit = (name: string) => {
    if (out.has(name)) return;
    out.add(name);
    for (const d of byName.get(name)?.dependencies ?? []) visit(d.name);
  };
  for (const s of selected) visit(s);
  return index.plugins.map((p) => p.name).filter((n) => out.has(n));
}

/** `.claude/settings.json` block for a team: marketplace registration plus enabled plugins. */
export function teamSettings(index: Index, selected: Iterable<string>, channel: Channel) {
  const name = marketplaceName(index, channel);
  const source = channel === 'stable'
    ? { source: 'url', url: stableMarketplaceUrl(index) }
    : { source: 'github', repo: index.marketplace.repo };
  return {
    extraKnownMarketplaces: { [name]: { source } },
    enabledPlugins: Object.fromEntries(withDependencies(index, selected).map((p) => [`${p}@${name}`, true])),
  };
}
