import { marked } from 'marked';
import { parseFragment } from 'parse5';

// Use existing prose when a documentation author has not supplied metadata.
export function docsDescription(body = '') {
    const tokens = marked.lexer(body.replace(/^import\s[^\n]+$/gm, ''));
    const paragraph = tokens.find(token => token.type === 'paragraph' && !/^\s*[<{]/.test(token.text));
    if (!paragraph) return '';
    const fragment = parseFragment(marked.parseInline(paragraph.text));
    const text = node => node.nodeName === '#text' ? node.value : (node.childNodes ?? []).map(text).join('');
    const prose = text(fragment).replace(/\s+/g, ' ').trim();
    if (prose.length <= 180) return prose;
    return prose.slice(0, 177).replace(/\s+\S*$/, '') + '…';
}
