import { readdir, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'parse5';
import { siteUrl } from './core-pages.mjs';

const attr = (node, name) => node.attrs?.find(a => a.name === name)?.value;
const normalize = path => path.replace(/\/index\.html$/, '/').replace(/\/$/, '') || '/';
export function inspectLinks(html, path) {
    const links = [], ids = new Set();
    function visit(node) {
        if (attr(node, 'id')) ids.add(attr(node, 'id'));
        if (node.tagName === 'a') {
            if (attr(node, 'name')) ids.add(attr(node, 'name'));
            const href = attr(node, 'href');
            if (href != null) links.push(new URL(href, siteUrl + path));
        }
        for (const child of node.childNodes ?? []) visit(child);
    }
    visit(parse(html));
    return { links, ids };
}
export function validateLinks(pages, files, redirects = new Map()) {
    const errors = [];
    for (const [source, page] of pages) for (const original of page.links) {
        let url = new URL(original), seen = new Set();
        while (url.origin === siteUrl && redirects.has(normalize(url.pathname))) {
            const path = normalize(url.pathname);
            if (seen.has(path)) { errors.push(`${source}: redirect loop at ${original}`); break; }
            seen.add(path);
            const next = new URL(redirects.get(path), url);
            if (!next.hash) next.hash = url.hash;
            url = next;
        }
        if (seen.has(normalize(url.pathname)) || url.origin !== siteUrl) continue;
        const target = normalize(decodeURIComponent(url.pathname));
        const targetPage = pages.get(target);
        if (!targetPage && !files.has(target)) errors.push(`${source}: missing target ${original}`);
        else if (targetPage && url.hash && !targetPage.ids.has(decodeURIComponent(url.hash.slice(1))) && !url.hash.startsWith('#:~:text=')) errors.push(`${source}: missing anchor ${original}`);
    }
    return [...new Set(errors)];
}
export async function checkLinks(directory = 'dist') {
    const files = new Set(), pages = new Map(), redirects = new Map();
    async function walk(prefix = '') {
        for (const entry of await readdir(join(directory, prefix), { withFileTypes: true })) {
            if (entry.name === '_worker.js') continue;
            const file = join(prefix, entry.name);
            if (entry.isDirectory()) await walk(file);
            else {
                files.add(normalize('/' + file));
                if (file.endsWith('.html')) {
                    const path = file.endsWith('index.html') ? '/' + file.slice(0, -10) : '/' + file;
                    pages.set(normalize(path), inspectLinks(await readFile(join(directory, file), 'utf8'), path));
                }
            }
        }
    }
    await walk();
    for (const line of (await readFile(join(directory, '_redirects'), 'utf8')).split('\n')) {
        const [from, to] = line.trim().split(/\s+/);
        if (from?.startsWith('/') && to) redirects.set(normalize(from), to);
    }
    const errors = validateLinks(pages, files, redirects);
    if (errors.length) throw new Error(`Internal links failed:\n${errors.join('\n')}`);
    console.log(`Internal links and anchors verified in ${pages.size} rendered HTML pages.`);
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await checkLinks();
