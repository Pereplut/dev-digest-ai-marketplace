import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { Artifact, Catalog, Channel, PluginRow } from '../types';
import { renderMarkdown } from '../lib/markdown';
import { href } from '../lib/router';
import { highlight } from '../lib/search';
import { channelVersion, installCommand } from '../lib/commands';

interface Ctx {
  catalog: Catalog;
  channel: Channel;
  setChannel: (c: Channel) => void;
}

export const CatalogContext = createContext<Ctx | null>(null);

export function useCatalog(): Ctx {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('useCatalog outside CatalogContext');
  return ctx;
}

export function formatTokens(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10_000 ? 0 : 1)}k` : String(n);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Insecure context or denied permission: fall back to a selected textarea.
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}

export function CopyButton({ text, label = 'Copy', testId }: { text: string; label?: string; testId?: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  return (
    <button
      type="button"
      className="btn btn-copy"
      data-testid={testId}
      onClick={async () => {
        setState((await copyText(text)) ? 'copied' : 'failed');
        setTimeout(() => setState('idle'), 1600);
      }}
    >
      <span aria-live="polite">{state === 'copied' ? 'Copied' : state === 'failed' ? 'Select and copy' : label}</span>
    </button>
  );
}

export function Command({ text, testId }: { text: string; testId?: string }) {
  return (
    <div className="command">
      <code>{text}</code>
      <CopyButton text={text} testId={testId} />
    </div>
  );
}

export function Markdown({ md, linkBase }: { md: string; linkBase?: string }) {
  const html = useMemo(() => renderMarkdown(md, linkBase), [md, linkBase]);
  // Sanitized by DOMPurify in renderMarkdown (SITE-SPEC AC-6).
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function Badge({ kind, children }: { kind: string; children: ReactNode }) {
  return <span className={`badge badge-${kind}`}>{children}</span>;
}

export function Highlighted({ text, terms }: { text: string; terms: string[] }) {
  return (
    <>
      {highlight(text, terms).map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
    </>
  );
}

export function TokenBadge({ id }: { id: string }) {
  const { catalog } = useCatalog();
  const s = catalog.stats.artifacts[id];
  if (!s) return null;
  return (
    <span className="tokens" title={`Estimated: ${catalog.stats.method}. Body ${s.tokens} tokens; description always in context: ${s.discoveryTokens}.`}>
      ~{formatTokens(s.tokens)} tok
    </span>
  );
}

export function PluginCard({ plugin }: { plugin: PluginRow }) {
  const { catalog, channel } = useCatalog();
  const version = channelVersion(plugin, channel);
  const s = catalog.stats.plugins[plugin.name];
  return (
    <article className="card" data-testid={`plugin-card-${plugin.name}`}>
      <header className="card-head">
        <Badge kind="plugin">plugin</Badge>
        <a className="card-title" href={href('plugin', plugin.name)}>{plugin.name}</a>
        <span className="version">{version ? `v${version}` : 'not on stable'}</span>
      </header>
      <p className="card-desc">{plugin.summary}</p>
      <p className="meta">
        {s.skills > 0 && <span>{s.skills} skill{s.skills > 1 ? 's' : ''}</span>}
        {s.agents > 0 && <span>{s.agents} agent{s.agents > 1 ? 's' : ''}</span>}
        {plugin.dependencies.length > 0 && <span>needs {plugin.dependencies.map((d) => d.name).join(', ')}</span>}
      </p>
      <Command text={installCommand(catalog.index, plugin.name, channel)} testId={`copy-install-${plugin.name}`} />
    </article>
  );
}

export function ArtifactCard({ artifact, terms = [] }: { artifact: Artifact; terms?: string[] }) {
  return (
    <article className="card" data-testid={`artifact-card-${artifact.id}`}>
      <header className="card-head">
        <Badge kind={artifact.type}>{artifact.type}</Badge>
        <a className="card-title" href={href('artifact', artifact.id)}>
          <Highlighted text={artifact.name} terms={terms} />
        </a>
        <TokenBadge id={artifact.id} />
      </header>
      <p className="card-plugin">
        in <a href={href('plugin', artifact.plugin)}>{artifact.plugin}</a>
        {artifact.manual && <span className="pill">manual only</span>}
      </p>
      <p className="card-desc clamp">
        <Highlighted text={artifact.description} terms={terms} />
      </p>
      <code className="invocation">{artifact.invocation}</code>
    </article>
  );
}
