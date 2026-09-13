import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { corePages, marketingPages, inlineMarketingPages, retiredPages, siteUrl, normalizePath } from './core-pages.mjs';

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
function elements(node, predicate, result = []) {
    if (predicate(node)) result.push(node);
    for (const child of node.childNodes ?? []) elements(child, predicate, result);
    return result;
}
export function inspectPage(html, path) {
    const doc = parse(html);
    const canonical = elements(doc, n => n.tagName === 'link' && attr(n, 'rel') === 'canonical').map(n => attr(n, 'href'));
    const noindex = elements(doc, n => n.tagName === 'meta' && /^(robots|googlebot|bingbot)$/i.test(attr(n, 'name') ?? '') && /\b(noindex|none)\b/i.test(attr(n, 'content') ?? '')).length > 0;
    const links = elements(doc, n => n.tagName === 'a' && attr(n, 'href')).flatMap(n => {
        try {
            const url = new URL(attr(n, 'href'), siteUrl + path);
            return url.origin === siteUrl && !/\bnofollow\b/.test(attr(n, 'rel') ?? '') ? [normalizePath(url.pathname)] : [];
        } catch { return []; }
    });
    return { canonical, noindex, links };
}
export function validateDiscovery({ pages, sitemap, llms, full, robots }, required = corePages) {
    const failures = [];
    for (const path of required) {
        const page = pages.get(path);
        if (!page) { failures.push(`${path}: missing HTML`); continue; }
        if (!sitemap.has(path)) failures.push(`${path}: absent from sitemap`);
        if (![`${siteUrl}${path}`, `${siteUrl}${path}index.md`].some(url => llms.includes(`](${url})`))) failures.push(`${path}: absent from llms.txt index`);
        if (page.canonical.length !== 1 || page.canonical[0] !== siteUrl + path) failures.push(`${path}: incorrect canonical`);
        if (page.noindex) failures.push(`${path}: noindex`);
        if (![...pages].some(([from, data]) => from !== path && data.links.includes(path))) failures.push(`${path}: no incoming internal link`);
    }
    for (const path of retiredPages) {
        if (pages.has(path) || sitemap.has(path) || llms.includes(path) || full.includes(path) || [...pages.values()].some(p => p.links.includes(path))) failures.push(`${path}: retired page remains discoverable`);
    }
    for (const path of marketingPages.filter(path => required.includes(path))) {
        if (!full.includes(`\nSource: ${siteUrl}${path}\n`)) failures.push(`${path}: absent from llms-full.txt`);
    }
    const linkedSources = marketingPages.filter(path => !inlineMarketingPages.includes(path)).map(path => siteUrl + path);
    const sharedContent = full.trimEnd()
        .split(/\n\n---\n\n(?=# [^\n]+\n\nSource: )/)
        .filter(section => !linkedSources.includes(section.match(/^Source: (.+)$/m)?.[1]))
        .join('\n\n---\n\n');
    if (!sharedContent.trim() || !llms.trimEnd().endsWith(sharedContent)) failures.push('Full text exports differ');
    if (!robots.includes(`Sitemap: ${siteUrl}/sitemap-index.xml`)) failures.push('robots.txt does not advertise the sitemap');
    return failures;
}
async function htmlPages(directory, prefix = '') {
    const result = new Map();
    for (const entry of await readdir(join(directory, prefix), {withFileTypes: true})) {
        if (entry.name.startsWith('_')) continue;
        const file = join(prefix, entry.name);
        if (entry.isDirectory()) for (const [path, page] of await htmlPages(directory, file)) result.set(path, page);
        else if (entry.name === 'index.html') {
            const path = '/' + prefix.replaceAll('\\', '/') + (prefix ? '/' : '');
            result.set(path, inspectPage(await readFile(join(directory, file), 'utf8'), path));
        }
    }
    return result;
}
export async function checkDiscovery(directory = 'dist') {
    const pages = await htmlPages(directory);
    const sitemap = new Set();
    const index = await readFile(join(directory, 'sitemap-index.xml'), 'utf8');
    const sitemapFiles = [...index.matchAll(/<loc>(.*?)<\/loc>/g)].map(([, location]) => {
        const url = new URL(location);
        if (url.origin !== siteUrl || !/^\/sitemap-\d+\.xml$/.test(url.pathname)) throw new Error('Unexpected sitemap location');
        return url.pathname.slice(1);
    });
    if (!sitemapFiles.length) throw new Error('Empty sitemap index');
    for (const file of sitemapFiles) {
        const xml = await readFile(join(directory, file), 'utf8');
        for (const [,url] of xml.matchAll(/<loc>(.*?)<\/loc>/g)) sitemap.add(normalizePath(new URL(url).pathname));
    }
    const [llms, full, robots] = await Promise.all(['llms.txt', 'llms-full.txt', 'robots.txt'].map(f => readFile(join(directory, f), 'utf8')));
    for (const path of corePages) {
        const markdown = await readFile(join(directory, path, 'index.md'), 'utf8');
        if (!markdown.includes(`Source: ${siteUrl}${path}`) || markdown.length < 100) throw new Error(`Missing or incomplete page Markdown: ${path}`);
    }
    const failures = validateDiscovery({pages, sitemap, llms, full, robots});
    if (failures.length) throw new Error(`Discoverability checks failed:\n${failures.join('\n')}`);
    console.log(`Discoverability verified for ${corePages.length} core pages.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkDiscovery();
