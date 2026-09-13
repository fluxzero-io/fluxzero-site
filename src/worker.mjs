import { createExports as createAstroExports } from '@astrojs/cloudflare/entrypoints/server.js';
import { negotiateMarkdown } from './server/markdown-negotiation.mjs';

export function createExports(manifest) {
    const astro = createAstroExports(manifest);
    return { default: { async fetch(request, env, context) {
        const url = new URL(request.url);
        if (['/monitoring', '/monitoring/', '/monitoring/index.html', '/monitoring/index.md'].includes(url.pathname)) {
            url.pathname = url.pathname.endsWith('.md') ? '/product-insight/index.md' : '/product-insight/';
            return Response.redirect(url.toString(), 302);
        }
        return await negotiateMarkdown(request, env.ASSETS) ?? astro.default.fetch(request, env, context);
    } } };
}
