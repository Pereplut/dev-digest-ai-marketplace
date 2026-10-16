// Every piece of repository Markdown reaches the DOM through here: marked, then DOMPurify (SITE-SPEC AC-6).
import { Marked } from 'marked';
import DOMPurify from 'dompurify';

const marked = new Marked({ gfm: true, async: false });

let hooked = false;
function hookLinks() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A' && node.getAttribute('href')?.match(/^https?:/)) {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

/**
 * Render Markdown to sanitized HTML. `linkBase` resolves relative links (README links to
 * `docs/x.md`) to the file on GitHub, since the site does not host those files.
 */
export function renderMarkdown(md: string, linkBase?: string): string {
  hookLinks();
  // Frontmatter is shown as structured data by the page, not as a paragraph of YAML.
  const body = md.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');
  const html = marked.parse(body) as string;
  const clean = DOMPurify.sanitize(html, { USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'input'], FORBID_ATTR: ['style'] });
  if (!linkBase) return clean;
  const doc = new DOMParser().parseFromString(clean, 'text/html');
  for (const a of doc.querySelectorAll('a[href]')) {
    const href = a.getAttribute('href')!;
    if (/^(https?:|mailto:|#)/.test(href)) continue;
    a.setAttribute('href', new URL(href, linkBase).toString());
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
  return doc.body.innerHTML;
}
