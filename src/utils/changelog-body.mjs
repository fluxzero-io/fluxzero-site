import { marked } from 'marked';
import GithubSlugger from 'github-slugger';
import { parseFragment, serialize } from 'parse5';

// Release bodies bypass Astro's Markdown heading renderer. Give their headings
// GitHub-compatible fragments, scoped to one release rather than the whole page.
export function renderChangelogBody(body, version) {
  const fragment = parseFragment(marked.parse(body, { async: false }));
  const slugger = new GithubSlugger();
  const anchors = new Map();
  const prefix = `release-${encodeURIComponent(version)}-`;
  const walk = (node, visit) => {
    visit(node);
    for (const child of node.childNodes ?? []) walk(child, visit);
  };
  const text = (node) => node.nodeName === '#text' ? node.value
    : node.tagName === 'img' ? node.attrs.find(a => a.name === 'alt')?.value ?? ''
      : (node.childNodes ?? []).map(text).join('');

  walk(fragment, (node) => {
    if (!/^h[1-6]$/.test(node.tagName ?? '')) return;
    let id = node.attrs.find(a => a.name === 'id');
    const anchor = id?.value ?? slugger.slug(text(node));
    if (!id) node.attrs.push(id = { name: 'id', value: '' });
    id.value = prefix + anchor;
    anchors.set(anchor, id.value);
  });
  walk(fragment, (node) => {
    if (node.tagName !== 'a') return;
    const href = node.attrs.find(a => a.name === 'href');
    if (!href?.value.startsWith('#')) return;
    let anchor;
    try { anchor = decodeURIComponent(href.value.slice(1)); } catch { return; }
    const target = anchors.get(anchor);
    // Keep unresolved links visible to the existing build-time link checker.
    if (target) href.value = '#' + target;
  });
  return serialize(fragment);
}
