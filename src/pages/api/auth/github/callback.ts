export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, makeCookie, absoluteCallbackURL, sealCookiePayload, unsealCookiePayload } from '../_utils';
export const GET: APIRoute = async ({ url, request }) => {
  const clientId = String(import.meta.env.GITHUB_APP_CLIENT_ID || '');
  const clientSecret = String(import.meta.env.GITHUB_APP_CLIENT_SECRET || '');
  const cookieSecret = String(import.meta.env.COOKIE_SECRET || '');
  if (!clientId || !clientSecret || !cookieSecret) {
    return new Response('Auth not configured', { status: 500 });
  }

  const qpState = url.searchParams.get('state') || '';
  const code = url.searchParams.get('code') || '';
  const cookies = parseCookies(request.headers.get('cookie'));
  let returnTo = cookies['fx_return_to'] || '/';
  // Prefer sealed `state` content for validation + returnTo; fall back to cookie comparison
  let stateOk = false;
  if (qpState && cookieSecret) {
    try {
      const parsed = await unsealCookiePayload(qpState, cookieSecret);
      if (parsed && parsed.n && typeof parsed.ts === 'number') {
        stateOk = true;
        if (parsed.returnTo) returnTo = parsed.returnTo;
      }
    } catch {}
  }
  if (!stateOk) {
    const cookieState = cookies['fx_gh_state'] || '';
    const isLocalhost = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    if (!isLocalhost) {
      if (!qpState || !code || !cookieState || qpState !== cookieState) {
        return new Response('Invalid state', { status: 400 });
      }
    } else {
      // In local development, relax state enforcement to unblock testing
      if (!returnTo) returnTo = '/';
    }
  }

  const callback = absoluteCallbackURL(url);
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: callback,
  });

  const resp = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'fluxzero-docs-feedback'
    },
    body: body.toString(),
  });
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    return new Response(isLocal ? `GitHub token exchange failed: ${resp.status} ${resp.statusText} ${txt}` : 'GitHub token exchange failed', { status: 502 });
  }
  const data = await resp.json() as any;
  if (!data.access_token) {
    const isLocal = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
    const details = data && (data.error || data.error_description) ? ` (${data.error || ''} ${data.error_description || ''})` : '';
    return new Response(isLocal ? `No access token received${details}` : 'No access token received', { status: 400 });
  }
  const now = Date.now();
  const expiresIn = Number(data.expires_in || 0);
  const payload = {
    access_token: data.access_token,
    token_type: data.token_type || 'bearer',
    refresh_token: data.refresh_token || null,
    refresh_token_expires_in: data.refresh_token_expires_in || null,
    expires_at: expiresIn ? new Date(now + expiresIn * 1000).toISOString() : null,
  };
  const sealed = await sealCookiePayload(payload, cookieSecret);

  const headers = new Headers();
  headers.set('Location', `${returnTo}?auth=ok`);
  const secure = url.protocol === 'https:';
  headers.append('Set-Cookie', makeCookie('fx_gh_auth', sealed, { path: '/api', maxAge: expiresIn || (24 * 3600), secure }));
  headers.append('Set-Cookie', makeCookie('fx_gh_state', '', { path: '/api/auth/github', secure, expires: new Date(0) }));
  headers.append('Set-Cookie', makeCookie('fx_return_to', '', { path: '/', secure, expires: new Date(0) }));
  return new Response(null, { status: 302, headers });
};
