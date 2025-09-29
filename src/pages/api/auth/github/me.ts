export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, unsealCookiePayload } from '../_utils';

export const GET: APIRoute = async ({ request }) => {
  try {
    if (String(import.meta.env.FEEDBACK_PROVIDER || '').toLowerCase() === 'memory') {
      return new Response(JSON.stringify({ login: 'local-user' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const cookies = parseCookies(request.headers.get('cookie'));
    const tokenBlob = cookies['fx_gh_auth'];
    if (!tokenBlob || !import.meta.env.COOKIE_SECRET) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }
    const payload = await unsealCookiePayload(tokenBlob, String(import.meta.env.COOKIE_SECRET));
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
