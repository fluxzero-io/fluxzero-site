import type { APIRoute } from 'astro';
export const prerender = false;
import { makeCookie, absoluteCallbackURL, sealCookiePayload } from '../_utils';

export const GET: APIRoute = async ({ url }) => {
  const clientId = import.meta.env.GITHUB_APP_CLIENT_ID as string;
  if (!clientId) {
    return new Response('GitHub App client id not configured', { status: 500 });
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const returnTo = url.searchParams.get('returnTo') || '/';
  const callback = absoluteCallbackURL(url);
  const authorize = new URL('https://github.com/login/oauth/authorize');
  const statePayload = { n: nonce, ts: Date.now(), returnTo };
  let state = nonce;
  if (import.meta.env.COOKIE_SECRET) {
    try { state = await sealCookiePayload(statePayload, String(import.meta.env.COOKIE_SECRET)); } catch {}
  }
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  const headers = new Headers();
  headers.set('Location', authorize.toString());
  const secure = url.protocol === 'https:'; // allow non-secure on localhost/dev
  // Fallback cookies for older state flow; callback will prefer sealed `state` param
  headers.append('Set-Cookie', makeCookie('fx_gh_state', nonce, { path: '/api/auth/github', maxAge: 600, secure }));
  headers.append('Set-Cookie', makeCookie('fx_return_to', returnTo, { path: '/', maxAge: 600, secure }));
  return new Response(null, { status: 302, headers });
};
