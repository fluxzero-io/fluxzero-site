import { corePages, normalizePath } from '../../scripts/core-pages.mjs';

export function prefersMarkdown(accept = '') {
    const ranges = accept.toLowerCase().split(',').map(part => {
        const [type, ...parameters] = part.trim().split(';').map(s => s.trim());
        const weight = parameters.find(p => p.startsWith('q='));
        const q = weight ? Number(weight.slice(2)) : 1;
        return { type, q: Number.isFinite(q) && q >= 0 && q <= 1 ? q : 0 };
    });
    const markdown = ranges.find(r => r.type === 'text/markdown');
    if (!markdown || markdown.q === 0) return false;
    const html = ranges.find(r => r.type === 'text/html') ?? ranges.find(r => r.type === 'text/*') ?? ranges.find(r => r.type === '*/*');
    return markdown.q > (html?.q ?? 0) || (markdown.q === html?.q && html.type !== 'text/html');
}

export async function negotiateMarkdown(request, assets) {
    const url = new URL(request.url);
    const path = normalizePath(url.pathname.replace(/\/index\.html$/, '/'));
    if (!['GET', 'HEAD'].includes(request.method) || !corePages.includes(path)) return undefined;
    const markdown = prefersMarkdown(request.headers.get('accept') ?? '');
    if (markdown) {
        url.pathname = path + 'index.md';
        url.search = '';
    }
    const response = await assets.fetch(new Request(url, request));
    const headers = new Headers(response.headers);
    const vary = headers.get('vary');
    if (vary !== '*' && !vary?.split(',').some(v => v.trim().toLowerCase() === 'accept')) headers.set('Vary', [vary, 'Accept'].filter(Boolean).join(', '));
    if (markdown && (response.ok || response.status === 304)) {
        headers.set('Content-Type', 'text/markdown; charset=utf-8');
        headers.set('Content-Location', path + 'index.md');
    }
    return new Response(request.method === 'HEAD' ? null : response.body, {status:response.status, statusText:response.statusText, headers});
}
