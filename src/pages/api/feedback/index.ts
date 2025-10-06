export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, unsealCookiePayload } from '../auth/_utils';
import { GitHubProvider } from './_github';
import { MemoryProvider } from './_memory';
import { getFeedbackProvider } from '~/scripts/inline-feedback/feedbackProvider';

export const GET: APIRoute = async ({ url }) => {
  try {
    const provider = getFeedbackProvider();

    const slug = url.searchParams.get('slug');
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let data;
    if (provider === 'memory') {
      data = await new MemoryProvider().listDiscussions(slug);
    } else if (provider === 'github') {
      const repo = String(import.meta.env.GITHUB_REPO || '');
      const token = String(import.meta.env.GITHUB_TOKEN || '');
      data = await new GitHubProvider(
        repo,
        token
      ).listDiscussions(slug);
    } else {
      return new Response(JSON.stringify({ error: 'Feedback disabled' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' } });
  } catch (e) {
    console.error(e)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const body = await request.json().catch(() => null) as any;
    if (!body || !body.slug || !body.selection?.text || !body.message) {
      return new Response(JSON.stringify({ error: 'Invalid payload' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    const provider = getFeedbackProvider();

    if (provider === 'memory') {
      const out = await new MemoryProvider().createDiscussion({
        slug: body.slug,
        selectionText: body.selection.text,
        selectionContext: body.selection?.context,
        segments: Array.isArray(body.selection?.segments) ? body.selection.segments : [],
        message: body.message
      });
      return new Response(JSON.stringify(out), { status: 201, headers: { 'Content-Type': 'application/json' } });
    } else if (provider === 'github') {

      const cookies = parseCookies(request.headers.get('cookie'));
      const authCookie = cookies['fx_gh_auth'];

      // GitHub provider requires auth cookie
      const cookieSecret = String(import.meta.env.COOKIE_SECRET || '');
      if (!authCookie || !cookieSecret) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json' } });
      }
      const tokenPayload = await unsealCookiePayload(authCookie, cookieSecret);
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
      return new Response(JSON.stringify({ error: 'Feedback disabled' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
