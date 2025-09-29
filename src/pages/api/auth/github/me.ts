import type { APIRoute } from 'astro';
import { getEnv, parseCookies, unsealCookiePayload } from '../_utils';
export const prerender = false;

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const env = getEnv((locals as any)?.runtime?.env);
    const cookies = parseCookies(request.headers.get('cookie'));
    const tokenBlob = cookies['fx_gh_auth'];
    if (!tokenBlob || !env.COOKIE_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const payload = await unsealCookiePayload(tokenBlob, env.COOKIE_SECRET);
    if (!payload?.access_token) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    // Query minimal user identity
    const resp = await fetch('https://api.github.com/user', {
      headers: { 'Authorization': `Bearer ${payload.access_token}`, 'User-Agent': 'fluxzero-docs-feedback', 'Accept': 'application/vnd.github+json' }
    });
    if (!resp.ok) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const user = await resp.json();
    return new Response(JSON.stringify({ login: user.login, avatar_url: user.avatar_url }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch {
    return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
  }
};
