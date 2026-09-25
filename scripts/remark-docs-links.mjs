import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'yaml';

// Resolve links to source documents using their published slug. Working on the
// Markdown tree leaves code examples and external URLs untouched.
export default function remarkDocsLinks() {
  return async (tree, file) => {
    if (!file.path) return;
    const pending = [];
    function visit(node) {
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
