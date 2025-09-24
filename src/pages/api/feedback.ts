// TODO: Migrate to GitHub App authentication for better security and rate limits
// Currently using Personal Access Token for simplicity
export const prerender = false;
import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  const slug = url.searchParams.get('slug');

  if (!slug) {
    return new Response(
      JSON.stringify({ error: 'slug parameter is required' }),
      {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  // Extract page slug from URL path (e.g., /docs/getting-started/introduction → getting-started/introduction)
  const pageSlug = slug.replace('/docs/', '');
  const slugFilter = `[slug:${pageSlug}]`;

  // GitHub GraphQL query to search discussions
  const query = `
    query GetDiscussions($searchQuery: String!, $first: Int!) {
      search(query: $searchQuery, type: DISCUSSION, first: $first) {
        discussionCount
        nodes {
          ... on Discussion {
            id
            title
            body
            url
            createdAt
            updatedAt
            author {
              login
              avatarUrl
            }
            comments {
              totalCount
            }
            reactions {
              totalCount
            }
            repository {
              nameWithOwner
            }
          }
        }
      }
    }
  `;

  // Build search query - search for discussions with slug in title
  const searchQuery = `repo:fluxzero-io/fluxzero-site "${slugFilter}" in:title`;

  try {
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${locals.runtime.env.GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback'
      },
      body: JSON.stringify({
        query,
        variables: {
          searchQuery,
          first: 50  // Limit to 50 discussions per page
        }
      })
    });

    if (!response.ok) {
      console.error('GitHub API error:', response.status, response.statusText);
      return new Response(
        JSON.stringify({ error: 'GitHub API error', status: response.status }),
        {
          status: response.status,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const data = await response.json();

    if (data.errors) {
      console.error('GitHub GraphQL errors:', data.errors);
      return new Response(
        JSON.stringify({ error: 'GitHub GraphQL error', details: data.errors }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Process each discussion to extract metadata and clean up body
    const discussions = data.data.search.nodes.map((discussion: any) => {
      // Extract metadata from HTML comment if present
      const metadataMatch = discussion.body.match(/<!-- FEEDBACK_METADATA\n(.*?)\n-->/s);
      let metadata = null;
      if (metadataMatch) {
        try {
          metadata = JSON.parse(metadataMatch[1]);
        } catch (e) {
          console.warn('Failed to parse feedback metadata:', e);
        }
      }

      // Clean body for display (remove metadata comment)
      const displayBody = discussion.body.replace(/<!-- FEEDBACK_METADATA.*?-->/s, '').trim();

      return {
        id: discussion.id,
        title: discussion.title,
        body: displayBody,
        originalBody: discussion.body, // Keep original for debugging
        url: discussion.url,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        author: discussion.author,
        commentCount: discussion.comments.totalCount,
        reactionCount: discussion.reactions.totalCount,
        repository: discussion.repository.nameWithOwner,
        metadata
      };
    });

    return new Response(
      JSON.stringify({
        slug: pageSlug,
        discussions,
        total: data.data.search.discussionCount
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'public, max-age=300' // Cache for 5 minutes
        }
      }
    );

  } catch (error) {
    console.error('Error fetching discussions:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};