import type { APIRoute } from 'astro';
export const prerender = false;
import { absoluteCallbackURL, makeCookie, sealCookiePayload } from '../_utils';

function safeReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return '/';
  return value;
}

export const GET: APIRoute = async ({ url, locals }) => {
  const {
    GITHUB_APP_CLIENT_ID,
    GITHUB_APP_CLIENT_SECRET,
    COOKIE_SECRET
  } = locals.runtime.env;
  if (!GITHUB_APP_CLIENT_ID || !COOKIE_SECRET || !GITHUB_APP_CLIENT_SECRET) {
    return new Response('Incorrect github configuration', { status: 500 });
  }

  const stateBytes = crypto.getRandomValues(new Uint8Array(16));
  const nonce = Array.from(stateBytes).map((b) => b.toString(16).padStart(2, '0')).join('');

  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const callback = absoluteCallbackURL(url);
  const authorize = new URL('https://github.com/login/oauth/authorize');
  const statePayload = { n: nonce, ts: Date.now(), returnTo };
  const state = await sealCookiePayload(statePayload, String(COOKIE_SECRET));
  authorize.searchParams.set('client_id', GITHUB_APP_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', callback);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('allow_signup', 'false');

  const headers = new Headers();
  headers.set('Location', authorize.toString());
  const secure = url.protocol === 'https:';
  headers.append('Set-Cookie', makeCookie('fx_gh_state', nonce, { path: '/api/auth/github', maxAge: 600, secure }));
  return new Response(null, { status: 302, headers });
};
