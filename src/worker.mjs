import { handle } from '@astrojs/cloudflare/handler';
import { redirectLegacyMonitoring } from './server/legacy-redirects.mjs';
import { negotiateMarkdown } from './server/markdown-negotiation.mjs';

export default { async fetch(request, env, context) {
    return redirectLegacyMonitoring(request) ?? await negotiateMarkdown(request, env.ASSETS) ?? handle(request, env, context);
} };
