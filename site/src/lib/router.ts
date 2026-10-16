// Hash routing: GitHub Pages has no rewrites, so every route lives after `#`.
import { useEffect, useState } from 'react';

export interface Route {
  name: string;
  param: string;
  query: URLSearchParams;
}

export function parseHash(hash: string): Route {
  const raw = hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [name = '', ...rest] = path.split('/');
  return { name, param: decodeURIComponent(rest.join('/')), query: new URLSearchParams(qs) };
}

export function href(name: string, param?: string, query?: Record<string, string | undefined>): string {
  const qs = new URLSearchParams(Object.entries(query ?? {}).filter((e): e is [string, string] => !!e[1])).toString();
  return `#/${name}${param ? `/${encodeURIComponent(param).replace(/%3A/g, ':')}` : ''}${qs ? `?${qs}` : ''}`;
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => {
      setRoute(parseHash(location.hash));
      // Query-only changes (typing in search) keep the scroll position; page changes reset it.
      if (parseHash(location.hash).name !== 'search') window.scrollTo(0, 0);
    };
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}
