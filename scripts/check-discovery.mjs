import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse, serialize } from 'parse5';
import { corePages, inlineMarketingPages, retiredPages, unlistedPages, unlistedLinkSources, siteUrl, normalizePath } from './core-pages.mjs';
import { inspectLinks } from './check-links.mjs';

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
    const allLinks = inspectLinks(html, path).links.filter(url => url.origin === siteUrl).map(url => normalizePath(url.pathname));
    for (const footer of elements(doc, n => n.tagName === 'footer')) {
        footer.parentNode.childNodes = footer.parentNode.childNodes.filter(n => n !== footer);
    }
    const nonFooterLinks = inspectLinks(serialize(doc), path).links.filter(url => url.origin === siteUrl).map(url => normalizePath(url.pathname));
    return { canonical, noindex, links, allLinks, nonFooterLinks };
}
export function validateDiscovery({ pages, sitemap, llms, markdown, robots }, required = corePages, unlisted = unlistedPages) {
    const failures = [];
    for (const path of required) {
        const page = pages.get(path);
        if (!page) { failures.push(`${path}: missing HTML`); continue; }
        if (!sitemap.has(path)) failures.push(`${path}: absent from sitemap`);
        if (![`${siteUrl}${path}`, `${siteUrl}${path}index.md`].some(url => llms.includes(`](${url})`))) failures.push(`${path}: absent from llms.txt index`);
        const text = markdown.get(path);
        if (!text?.includes(`\nSource: ${siteUrl}${path}\n`)) failures.push(`${path}: missing page Markdown`);
        if (inlineMarketingPages.includes(path) && (!text?.trim() || !llms.includes(text.trimEnd()))) failures.push(`${path}: incomplete content in llms.txt`);
        if (page.canonical.length !== 1 || page.canonical[0] !== siteUrl + path) failures.push(`${path}: incorrect canonical`);
        if (page.noindex) failures.push(`${path}: noindex`);
        if (![...pages].some(([from, data]) => from !== path && data.links.includes(path))) failures.push(`${path}: no incoming internal link`);
    }
    for (const path of retiredPages) {
        if (pages.has(path) || sitemap.has(path) || llms.includes(path) || [...markdown.values()].some(text => text.includes(path)) || [...pages.values()].some(p => p.links.includes(path))) failures.push(`${path}: retired page remains discoverable`);
    }
    for (const path of unlisted) {
        const allowed = unlistedLinkSources[path] ?? { pages: [] };
        if (!pages.get(path)?.noindex) failures.push(`${path}: unlisted page must exist with noindex`);
        if (sitemap.has(path) || llms.includes(path.replace(/\/$/, '')) || markdown.has(path) || [...markdown].some(([from, text]) => !allowed.pages.includes(from) && text.includes(path.replace(/\/$/, '')))) failures.push(`${path}: unlisted page appears in public indexes`);
        if ([...pages].some(([from, page]) => from !== path && !allowed.pages.includes(from) && (allowed.footer ? page.nonFooterLinks : page.allLinks).includes(path))) failures.push(`${path}: unlisted page has an incoming link`);
    }
    if (llms.includes('/llms-full.txt')) failures.push('llms.txt links to its own alias');
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
    const [llms, robots] = await Promise.all(['llms.txt', 'robots.txt'].map(f => readFile(join(directory, f), 'utf8')));
    const markdown = new Map();
    for (const path of corePages) {
        const text = await readFile(join(directory, path, 'index.md'), 'utf8');
        if (text.length < 100) throw new Error(`Missing or incomplete page Markdown: ${path}`);
        markdown.set(path, text);
    }
    const failures = validateDiscovery({pages, sitemap, llms, markdown, robots});
    if (failures.length) throw new Error(`Discoverability checks failed:\n${failures.join('\n')}`);
    console.log(`Discoverability verified for ${corePages.length} core pages.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkDiscovery();
