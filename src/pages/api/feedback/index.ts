export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, unsealCookiePayload } from '../auth/_utils';
import { GitHubProvider } from './_github';
import { MemoryProvider } from './_memory';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const pref = String(import.meta.env.FEEDBACK_PROVIDER || '').toLowerCase();

    const slug = url.searchParams.get('slug');
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    
    let data;
    if (pref === 'memory') {
      data = await new MemoryProvider().listDiscussions(slug);
    } else if (pref === 'github') {
      data = await new GitHubProvider(
        String(import.meta.env.GITHUB_REPO || ''),
        String(import.meta.env.GITHUB_TOKEN || '')
      ).listDiscussions(slug);
    } else {
      return new Response(JSON.stringify({ error: "FEEDBACK_PROVIDER must be 'memory' or 'github'" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request, url, locals }) => {
  try {
    const body = await request.json().catch(() => null) as any;
    if (!body || !body.slug || !body.selection?.text || !body.message) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const providerPref = String(import.meta.env.FEEDBACK_PROVIDER || '').toLowerCase();

    if (providerPref === 'memory') {
      const out = await new MemoryProvider().createDiscussion({
        slug: body.slug,
        selectionText: body.selection.text,
        selectionContext: body.selection?.context,
        segments: Array.isArray(body.selection?.segments) ? body.selection.segments : [],
        message: body.message
      });
      return new Response(JSON.stringify(out), { status: 201, headers: { 'Content-Type': 'application/json' } });
    } else if (providerPref === 'github') {

      const cookies = parseCookies(request.headers.get('cookie'));
      const authCookie = cookies['fx_gh_auth'];

      // GitHub provider requires auth cookie
      if (!authCookie || ! import.meta.env.COOKIE_SECRET) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const tokenPayload = await unsealCookiePayload(authCookie, String(import.meta.env.COOKIE_SECRET || ''));
      const accessToken = tokenPayload?.access_token as string | undefined;
      if (!accessToken) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      try {
        const out = await new GitHubProvider(
          String(import.meta.env.GITHUB_REPO || ''),
          String(import.meta.env.GITHUB_TOKEN || ''),
          accessToken
        )
          .createDiscussion({
            slug: body.slug,
            selectionText: body.selection.text,
            selectionContext: body.selection?.context,
            segments: Array.isArray(body.selection?.segments) ? body.selection.segments : [],
            message: body.message
          });
        return new Response(JSON.stringify(out), { status: 201, headers: { 'Content-Type': 'application/json' } });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: 'Failed to create discussion', details: String(e?.message || e) }), { status: 502, headers: { 'Content-Type': 'application/json' } });
      }
    } else {
      return new Response(JSON.stringify({ error: "FEEDBACK_PROVIDER must be 'memory' or 'github'" }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
