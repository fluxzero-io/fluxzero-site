export const prerender = false;
import type { APIRoute } from 'astro';
import { makeCookie } from '../_utils';

export const POST: APIRoute = async ({ url }) => {
  const secure = url.protocol === 'https:';
  const headers = new Headers({ 'Content-Type': 'application/json' });
  headers.append('Set-Cookie', makeCookie('fx_gh_auth', '', { path: '/api', secure, expires: new Date(0) }));
  headers.append('Set-Cookie', makeCookie('fx_gh_state', '', { path: '/api/auth/github', secure, expires: new Date(0) }));
  headers.append('Set-Cookie', makeCookie('fx_return_to', '', { path: '/', secure, expires: new Date(0) }));
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
};
