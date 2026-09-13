import { createExports as createAstroExports } from '@astrojs/cloudflare/entrypoints/server.js';
import { negotiateMarkdown } from './server/markdown-negotiation.mjs';

export function createExports(manifest) {
    const astro = createAstroExports(manifest);
    return { default: { async fetch(request, env, context) {
        return await negotiateMarkdown(request, env.ASSETS) ?? astro.default.fetch(request, env, context);
    } } };
}
