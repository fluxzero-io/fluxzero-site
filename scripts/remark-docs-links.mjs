import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

// Resolve links to source documents using their published slug. Working on the
// Markdown tree leaves code examples and external URLs untouched.
export default function remarkDocsLinks({ siteUrl, linkAliases = {} } = {}) {
  function canonicalLink(href) {
    if (!siteUrl || !/^(?:\/|https?:\/\/)/.test(href)) return href;
    const url = new URL(href, siteUrl);
    const destination = url.origin === new URL(siteUrl).origin && linkAliases[url.pathname.replace(/\/$/, '')];
    if (!destination) return href;
    const target = new URL(destination, siteUrl);
    target.search = url.search;
    if (!target.hash) target.hash = url.hash;
    return target.pathname + target.search + target.hash;
  }
  return async (tree, file) => {
    if (!file.path) return;
    const pending = [];
    function visit(node) {
      if (node.type === 'link' || node.type === 'definition') node.url = canonicalLink(node.url);
      if ((node.type === 'mdxJsxFlowElement' || node.type === 'mdxJsxTextElement') && node.name === 'a') {
        const href = node.attributes?.find(attribute => attribute.name === 'href');
        if (typeof href?.value === 'string') href.value = canonicalLink(href.value);
      }
      if ((node.type === 'link' || node.type === 'definition') &&
          /^\.{1,2}\//.test(node.url)) {
        const match = node.url.match(/^([^?#]+\.mdx?)([?#].*)?$/i);
        if (match) pending.push(resolve(node, match));
      }
      for (const child of node.children ?? []) visit(child);
    }
    async function resolve(node, [, relativePath, suffix = '']) {
      const target = path.resolve(path.dirname(file.path), decodeURIComponent(relativePath));
      let source;
      try {
        source = await readFile(target, 'utf8');
      } catch (error) {
        if (error.code === 'ENOENT') {
          file.fail(`Documentation link target does not exist: ${relativePath}`, node);
        }
        throw error;
      }
      const frontmatter = source.match(/^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      const slug = frontmatter && parse(frontmatter[1])?.slug;
      if (typeof slug !== 'string' || !slug.trim()) {
        file.fail(`Documentation link target needs a published slug: ${relativePath}`, node);
      }
      node.url = `/${slug.replace(/^\/+|\/+$/g, '')}/${suffix}`;
    }
    visit(tree);
    await Promise.all(pending);
  };
}
