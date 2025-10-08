export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, unsealCookiePayload } from '../auth/_utils';
import { GitHubDiscussionsProvider } from './github-discussions';
import { GitHubIssuesProvider } from './github-issues';
import { MemoryProvider } from './_memory';
import {
  FEEDBACK_PROVIDER,
  GITHUB_REPO,
  GITHUB_TOKEN,
} from 'astro:env/server';
import type { FeedbackProvider } from './types';


function getFeedbackProvider(userAccessToken?: string): FeedbackProvider {
  switch (FEEDBACK_PROVIDER) {
    case 'github-discussions':
      if (!GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error('GitHub repo or token not configured');
      }
      return new GitHubDiscussionsProvider(GITHUB_REPO, GITHUB_TOKEN, userAccessToken);
    case 'github-issues':
      if (!GITHUB_REPO || !GITHUB_TOKEN) {
        throw new Error('GitHub repo or token not configured');
      }
      return new GitHubIssuesProvider(GITHUB_REPO, GITHUB_TOKEN, userAccessToken);
    case 'memory':
      return new MemoryProvider();
    default:
      throw new Error('No valid feedback provider configured');
  }

}

async function getUserTokenFromRequest(request: Request): Promise<string> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const authCookie = cookies['fx_gh_auth'];

  // GitHub provider requires auth cookie
  const cookieSecret = String(import.meta.env.COOKIE_SECRET || '');
  if (!authCookie || !cookieSecret) {
    throw new Error('No cookie_secret set or not auth cookie');
  }
  const tokenPayload = await unsealCookiePayload(authCookie, cookieSecret);
  const accessToken = tokenPayload?.access_token as string | undefined;
  if (!accessToken) {
    throw new Error('No access token in auth cookie');
  }
  return accessToken;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {

    const slug = url.searchParams.get('slug');
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let data = await getFeedbackProvider().listDiscussions(slug)
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

    const token = await getUserTokenFromRequest(request);
    const provider = getFeedbackProvider(token);
    const out = await provider.createDiscussion({
      slug: body.slug,
      selectionText: body.selection.text,
      selectionContext: body.selection?.context,
      segments: Array.isArray(body.selection?.segments) ? body.selection.segments : [],
      message: body.message
    });
    return new Response(JSON.stringify(out), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Failed to submit feedback' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
