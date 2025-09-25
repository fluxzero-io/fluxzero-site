// TODO: Migrate to GitHub App authentication for better security and rate limits
// Currently using Personal Access Token for simplicity
export const prerender = false;
import type { APIRoute } from 'astro';
import { marked } from 'marked';

// Mock data for local development
function getMockFeedbackData(pageSlug: string) {
  return {
    data: {
      search: {
        discussionCount: 2,
        nodes: [
          {
            id: "D_kwDOTest1234567",
            title: `[slug:${pageSlug}] What exactly are messages and handlers?`,
            body: `## Documentation Feedback

**Page**: [Introduction](${pageSlug})
**Selected Text**:
> you just write messages and handlers

## User Feedback
This sounds really interesting, but I'm not clear on what "messages and handlers" actually look like in practice. Could you provide a simple example to help me understand the concept better?

---
*This feedback was submitted through the documentation site.*

<!-- FEEDBACK_METADATA
{
  "version": 1,
  "page": "${pageSlug}",
  "selection": {
    "text": "you just write messages and handlers",
    "context": {
      "prefix": "Instead of gluing together tools, layering service code, mapping models, and wiring up infrastructure, **",
      "suffix": "**. Fluxzero takes care of everything else"
    }
  },
  "timestamp": "2025-09-24T15:30:00Z"
}
-->`,
            url: "https://github.com/fluxzero-io/fluxzero-site/discussions/123",
            createdAt: "2025-09-24T15:30:00Z",
            updatedAt: "2025-09-24T16:00:00Z",
            author: {
              login: "developer123",
              avatarUrl: "https://avatars.githubusercontent.com/u/12345?v=4"
            },
            comments: {
              totalCount: 3
            },
            reactions: {
              totalCount: 5
            },
            repository: {
              nameWithOwner: "fluxzero-io/fluxzero-site"
            }
          },
          {
            id: "D_kwDOTest7890123",
            title: `[slug:${pageSlug}] How does this compare to building a traditional backend?`,
            body: `## Documentation Feedback

**Page**: [Introduction](${pageSlug})
**Selected Text**:
> Fluxzero is a cloud runtime for building backends without infrastructure overhead

## User Feedback
This sounds promising, but I'm curious about the learning curve. How different is this from building a traditional REST API with Express.js or Spring Boot? Is there migration path from existing backends?

---
*This feedback was submitted through the documentation site.*`,
            url: "https://github.com/fluxzero-io/fluxzero-site/discussions/124",
            createdAt: "2025-09-24T14:15:00Z",
            updatedAt: "2025-09-24T14:15:00Z",
            author: {
              login: "newbie_dev",
              avatarUrl: "https://avatars.githubusercontent.com/u/67890?v=4"
            },
            comments: {
              totalCount: 1
            },
            reactions: {
              totalCount: 2
            },
            repository: {
              nameWithOwner: "fluxzero-io/fluxzero-site"
            }
          }
        ]
      }
    }
  };
}

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
  const pageSlug = slug
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

  // Use mock data for localhost development
  const isLocalhost = false //url.hostname === 'localhost' || url.hostname === '127.0.0.1';

  try {
    let data;

    if (isLocalhost) {
      // Return mock data for local development
      console.log('Using mock data for localhost');
      data = getMockFeedbackData(pageSlug);
    } else {
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

      const responseData = await response.json();

      if (responseData.errors) {
        console.error('GitHub GraphQL errors:', responseData.errors);
        return new Response(
          JSON.stringify({ error: 'GitHub GraphQL error', details: responseData.errors }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      data = responseData;
    }

    // Process each discussion to extract metadata and clean up body
    const discussions = data.data.search.nodes.map((discussion: any) => {
      // Extract metadata from HTML comment if present
      const metadataMatch = discussion.body.match(/<!-- FEEDBACK_METADATA\r?\n(.*?)\r?\n-->/s);
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

      // Convert markdown to HTML
      const htmlBody = marked(displayBody);

      // Clean title (remove slug prefix)
      const cleanTitle = discussion.title.replace(/\[slug:[^\]]+\]\s*/g, '').trim();

      return {
        id: discussion.id,
        title: cleanTitle,
        body: htmlBody,
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