import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marketingPages, unlistedPages, normalizePath } from './core-pages.mjs';

// Git dates survive fresh checkouts. Never use build time or copied-file mtimes.
export function lastChanged(cwd, files) {
    try {
        return execFileSync('git', ['log', '-1', '--format=%cI', '--', ...files], {cwd, encoding:'utf8', stdio:['ignore','pipe','pipe']}).trim() || undefined;
    } catch { return undefined; }
}
async function docsSources(directory, prefix = '') {
    const sources = [];
    for (const entry of await readdir(join(directory, prefix), {withFileTypes:true})) {
        const file = join(prefix, entry.name);
        if (entry.isDirectory()) sources.push(...await docsSources(directory, file));
        else if (entry.name.endsWith('.mdx')) {
            const content = await readFile(join(directory, file), 'utf8');
            const slug = content.match(/^slug:\s*["']?([^\n"']+)/m)?.[1]?.trim() ?? `docs/${file.replace(/\.mdx$/, '')}`;
            sources.push({path:`/${slug.replace(/^\/|\/$/g, '')}/`, file});
        }
    }
    return sources;
}
export async function addSitemapDates(directory = 'dist') {
    const dates = new Map(marketingPages.map(path => [path, lastChanged(process.cwd(), [`src/pages/${path === '/' ? 'index' : path.slice(1,-1)}.astro`])]));
    const docsRoot = resolve(process.env.FLUXZERO_SDK_DOCS_SOURCE ?? '../fluxzero-sdk-java/docs/developer');
    for (const {path,file} of await docsSources(docsRoot)) dates.set(path, lastChanged(docsRoot,[file]));
    // This generated page is owned by the website's public release cache.
    dates.set('/docs/about/changelog/', lastChanged(process.cwd(), ['src/data/changelog-cache.json']));
    let count = 0;
    for (const file of await readdir(directory)) if (/^sitemap-\d+\.xml$/.test(file)) {
        const target = join(directory,file);
        const xml = await readFile(target,'utf8');
        const updated = xml.replace(/<url>([\s\S]*?)<\/url>/g, (match,body) => {
            const url = body.match(/<loc>(.*?)<\/loc>/)?.[1];
            if (url && unlistedPages.includes(normalizePath(new URL(url).pathname))) return '';
            const date = url && dates.get(new URL(url).pathname);
            if (!date) return match;
            count++;
            return `<url>${body.replace(/<lastmod>.*?<\/lastmod>/g,'')}<lastmod>${date}</lastmod></url>`;
        });
        await writeFile(target,updated);
    }
    console.log(`Added source change dates to ${count} sitemap entries.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await addSitemapDates();
