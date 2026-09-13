import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketingPages } from './core-pages.mjs';

// Keep documentation styles cacheable. Marketing entry pages embed their small
// compiled stylesheets so first paint does not wait for additional requests.
export async function inlineMarketingCss(directory = 'dist') {
    for (const path of marketingPages) {
        const file = join(directory, path, 'index.html');
        let html = await readFile(file, 'utf8');
        const links = [...html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/g)];
        for (const [tag] of links) {
            const href = tag.match(/href="([^"?]+)(?:\?[^"]*)?"/)?.[1];
            if (!href?.startsWith('/_astro/')) continue;
            let css = await readFile(join(directory, href), 'utf8');
            css = css.replace(/url\((['"]?)([^)'"\s]+)\1\)/g, (match, quote, url) => {
                if (/^(?:\/|#|data:|https?:)/.test(url)) return match;
                return `url(${quote}${new URL(url, 'https://fluxzero.io' + href).pathname}${quote})`;
            });
            html = html.replace(tag, `<style>${css.replace(/<\/style/gi, '<\\/style')}</style>`);
        }
        await writeFile(file, html);
    }
    console.log(`Inlined compiled CSS for ${marketingPages.length} marketing pages.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await inlineMarketingCss();
