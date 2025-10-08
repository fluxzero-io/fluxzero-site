import { marked } from 'marked';
import type { FeedbackProvider, ListResult, CreateInput, CreateResult } from './types';
import { buildTitle, buildBody, extractUserFeedbackSection } from './util';

export class GitHubIssuesProvider implements FeedbackProvider {
  constructor(private githubRepo: string, private githubToken: string, private userToken?: string) {}

  private get headers() {
    return {
      Authorization: `Bearer ${this.githubToken}`,
      'Content-Type': 'application/json',
      'User-Agent': 'fluxzero-docs-feedback',
    };
  }

  async listDiscussions(slug: string): Promise<ListResult> {
    const path = new URL(slug, 'http://x').pathname;
    const pageSlug = (path.startsWith('/') ? path : `/${path}`).replace(/\/+$/, '');
    const searchQuery = `repo:${this.githubRepo} "[${pageSlug}]" in:title type:issue`;

    if (!this.githubToken) {
      return { slug: pageSlug, discussions: [], total: 0 };
    }
    
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        query: `
          query GetIssues($searchQuery: String!, $first: Int!) {
            search(query: $searchQuery, type: ISSUE, first: $first) {
              issueCount
              nodes {
                ... on Issue {
                  id
                  number
                  title
                  body
                  url
                  closed
                  createdAt
                  updatedAt
                  author { login avatarUrl }
                  comments { totalCount }
                  reactions { totalCount }
                  repository { nameWithOwner }
                }
              }
            }
          }
        `,
        variables: { searchQuery, first: 50 },
      }),
    });

    if (!response.ok) {
      return { slug: pageSlug, discussions: [], total: 0 };
    }

    const data = await response.json();
    const nodes = data?.data?.search?.nodes || [];
    const discussions = nodes.map((issue: any) => {
      const metadataMatch = issue.body?.match(/<!-- FEEDBACK_METADATA\r?\n(.*?)\r?\n-->/s);
      let metadata = null;
      if (metadataMatch) {
        try { metadata = JSON.parse(metadataMatch[1]); } catch { /* ignore */ }
      }
      const displayBody = (issue.body || '').replace(/<!-- FEEDBACK_METADATA.*?-->/s, '').trim();
      const feedbackMarkdown = extractUserFeedbackSection(displayBody) || displayBody;
      const htmlBody = marked(feedbackMarkdown);
      const cleanTitle = (issue.title || '').replace(/\[slug:[^\]]+\]\s*/g, '').trim();
      return {
        id: issue.id,
        title: cleanTitle,
        body: htmlBody,
        originalBody: issue.body,
        url: issue.url,
        closed: issue.closed,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        author: issue.author,
        commentCount: issue.comments?.totalCount ?? 0,
        reactionCount: issue.reactions?.totalCount ?? 0,
        repository: issue.repository?.nameWithOwner ?? this.githubRepo,
        metadata,
      };
    });

    return {
      slug: pageSlug,
      discussions,
      total: data?.data?.search?.issueCount || discussions.length,
    };
  }

  async createDiscussion(options: CreateInput): Promise<CreateResult> {
    if (!this.userToken) {
      throw new Error('missing_user_token');
    }

    const [owner, name] = this.githubRepo.split('/');
    const title = buildTitle(options.slug, options.message);
    const body = buildBody(options.slug, options.selectionText, options.message, options.selectionContext, (options as any).segments);

    const mutation = `
      mutation CreateIssue($input: CreateIssueInput!) {
        createIssue(input: $input) {
          issue {
            id
            url
            title
            createdAt
            author { login avatarUrl }
          }
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.userToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback',
      },
      body: JSON.stringify({
        query: mutation,
        variables: {
          input: {
            repositoryId: await this.getRepositoryId(owner, name),
            title,
            body,
          },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok || data.errors) {
      throw new Error(`issue_create_failed:${response.status}:${JSON.stringify(data.errors || {})}`);
    }

    return { created: data.data.createIssue.issue };
  }

  private async getRepositoryId(owner: string, name: string): Promise<string> {
    const query = `
      query RepoId($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          id
        }
      }
    `;

    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.userToken || this.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback',
      },
      body: JSON.stringify({ query, variables: { owner, name } }),
    });

    if (!response.ok) {
      const txt = await response.text().catch(() => '');
      throw new Error(`repo_access:${response.status}:${txt}`);
    }

    const data = await response.json();
    const repoId = data?.data?.repository?.id;
    if (!repoId) {
      throw new Error('repo_access:repository_not_found_or_no_permissions');
    }

    return repoId;
  }
}
