import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';

// astro-mermaid 1.0.4 injects this fixed layout stylesheet on every page.
// Permit its exact content, without allowing other injected inline styles.
const mermaidLayoutStyleHash = "'sha256-HML5mmlTXRKatCHfJVIHuU1sdIz4wzfnMthYpDehy8s='";

// Run after CSS inlining: only the final, built styles may be applied. This
// prevents injected stylesheets from recoloring the already-dark homepage.
export function protectHomepageStyles(html) {
    const document = parse(html, { sourceCodeLocationInfo: true });
    const hashes = new Set();
    let insertionOffset;
    function visit(node) {
        if (node.tagName === 'meta' && node.attrs.some(({ name }) => name === 'charset')) {
            insertionOffset = node.sourceCodeLocation.endOffset;
        }
        if (node.tagName === 'meta' && node.attrs.some(({ name, value }) =>
            name === 'http-equiv' && value.toLowerCase() === 'content-security-policy')) {
            throw new Error('Homepage already has a Content Security Policy; merge policies explicitly.');
        }
        if (node.tagName === 'style') {
            const css = node.childNodes.map(({ value = '' }) => value).join('');
            hashes.add(`'sha256-${createHash('sha256').update(css).digest('base64')}'`);
        }
        node.childNodes?.forEach(visit);
    }
    visit(document);
    if (insertionOffset === undefined || !hashes.size) {
        throw new Error('Expected homepage charset and compiled styles before protecting styles.');
    }
    // Preserve the star positions and the scroll animation's custom properties.
    hashes.add(mermaidLayoutStyleHash);
    const policy = `style-src 'self' ${[...hashes].join(' ')}; style-src-attr 'unsafe-inline'`;
    const meta = `<meta http-equiv="Content-Security-Policy" content="${policy}">`;
    return html.slice(0, insertionOffset) + meta + html.slice(insertionOffset);
}

export async function protectBuiltHomepage(directory = 'dist') {
    const file = join(directory, 'index.html');
    await writeFile(file, protectHomepageStyles(await readFile(file, 'utf8')));
    console.log('Protected homepage styles with a content-hashed policy.');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    await protectBuiltHomepage();
}
