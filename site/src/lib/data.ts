// Loads the build-time catalog. Paths are relative so the site works under any Pages base path.
import { useEffect, useState } from 'react';
import type { Catalog, Channel } from '../types';

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export async function loadCatalog(): Promise<Catalog> {
  const [index, search, releases, stats] = await Promise.all([
    getJson<Catalog['index']>('./index.json'),
    getJson<Catalog['search']>('./search.json'),
    getJson<Catalog['releases']>('./releases.json'),
    getJson<Catalog['stats']>('./stats.json'),
  ]);
  return { index, search, releases, stats };
}

const bodyCache = new Map<string, Promise<string>>();

export function loadBody(path: string): Promise<string> {
  if (!bodyCache.has(path)) {
    bodyCache.set(path, fetch(`./${path}`).then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${path}: HTTP ${r.status}`)))));
  }
  return bodyCache.get(path)!;
}

export function useBody(path: string | undefined) {
  const [state, setState] = useState<{ path?: string; text?: string; error?: string }>({});
  useEffect(() => {
    if (!path) return;
    let live = true;
    loadBody(path).then(
      (text) => live && setState({ path, text }),
      (e: Error) => live && setState({ path, error: e.message }),
    );
    return () => { live = false; };
  }, [path]);
  return state.path === path ? state : {};
}

// The channel choice is a per-viewer convenience; storage may be unavailable (private mode).
const CHANNEL_KEY = 'channel';

export function readChannel(): Channel {
  try {
    return localStorage.getItem(CHANNEL_KEY) === 'stable' ? 'stable' : 'latest';
  } catch {
    return 'latest';
  }
}

export function saveChannel(c: Channel) {
  try {
    localStorage.setItem(CHANNEL_KEY, c);
  } catch {
    /* not persisted; the toggle still works for this visit */
  }
}
