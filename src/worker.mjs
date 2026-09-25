import { createExports as createAstroExports } from '@astrojs/cloudflare/entrypoints/server.js';
import { redirectLegacyMonitoring } from './server/legacy-redirects.mjs';
import { negotiateMarkdown } from './server/markdown-negotiation.mjs';

export function createExports(manifest) {
    const astro = createAstroExports(manifest);
    return { default: { async fetch(request, env, context) {
        return redirectLegacyMonitoring(request) ?? await negotiateMarkdown(request, env.ASSETS) ?? astro.default.fetch(request, env, context);
    } } };
}
