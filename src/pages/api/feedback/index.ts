export const prerender = false;
import type { APIRoute } from 'astro';
import { parseCookies, unsealCookiePayload } from '../auth/_utils';
import { GitHubDiscussionsProvider } from './github-discussions';
import { GitHubIssuesProvider } from './github-issues';
import { MemoryProvider } from './_memory';
import type { FeedbackProvider } from './types';
import { sanitizeSlug } from './util';


function getFeedbackProvider(env: Env, userAccessToken?: string): FeedbackProvider {
  switch (env.FEEDBACK_PROVIDER) {
    case 'github-discussions':
      if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
        throw new Error('GitHub repo or token not configured');
      }
      return new GitHubDiscussionsProvider(env.GITHUB_REPO, env.GITHUB_TOKEN, userAccessToken);
    case 'github-issues':
      if (!env.GITHUB_REPO || !env.GITHUB_TOKEN) {
        throw new Error('GitHub repo or token not configured');
      }
      return new GitHubIssuesProvider(env.GITHUB_REPO, env.GITHUB_TOKEN, userAccessToken);
    case 'memory':
      return new MemoryProvider();
    default:
      throw new Error('No valid feedback provider configured');
  }

}

async function getUserTokenFromRequest(request: Request, encryptionSecret: string): Promise<string> {
  const cookies = parseCookies(request.headers.get('cookie'));
  const authCookie = cookies['fx_gh_auth'];

  if (!authCookie || !encryptionSecret) {
    throw new Error('No cookie_secret set or not auth cookie');
  }
  const tokenPayload = await unsealCookiePayload(authCookie, encryptionSecret);
  const accessToken = tokenPayload?.access_token as string | undefined;
  if (!accessToken) {
    throw new Error('No access token in auth cookie');
  }
  return accessToken;
}

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const slug = sanitizeSlug(url.searchParams.get('slug') ?? '');
    if (!slug) {
      return new Response(JSON.stringify({ error: 'slug parameter is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    let data = await getFeedbackProvider(locals.runtime.env).listDiscussions(slug)
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

    const token = await getUserTokenFromRequest(request, locals.runtime.env.COOKIE_SECRET);
    const provider = getFeedbackProvider(locals.runtime.env, token);
    const out = await provider.createDiscussion({
      slug: sanitizeSlug(body.slug),
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
