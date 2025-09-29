import { marked } from 'marked';
import type { FeedbackProvider, ListResult, CreateInput, CreateResult } from './types';
import { buildTitle, buildBody } from './util';

export class GitHubProvider implements FeedbackProvider {
  constructor(private githubRepo: string, private githubToken: string, private userToken?: string) {
  }

  async listDiscussions(slug: string): Promise<ListResult> {
    const path = new URL(slug, 'http://x').pathname;
    const pageSlug = path.startsWith('/') ? path : `/${path}`;
    const slugFilter = pageSlug;

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
  `;
    const searchQuery = `repo:${this.githubRepo} "${slugFilter}" in:title,body`;
    if (!this.githubToken) {
      return { slug: pageSlug, discussions: [], total: 0 };
    }
    const response = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.githubToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback'
      },
      body: JSON.stringify({ query, variables: { searchQuery, first: 50 } })
    });
    if (!response.ok) {
      return { slug: pageSlug, discussions: [], total: 0 };
    }
    const data = await response.json();
    const nodes = data?.data?.search?.nodes || [];
    const discussions = nodes.map((discussion: any) => {
      const metadataMatch = discussion.body.match(/<!-- FEEDBACK_METADATA\r?\n(.*?)\r?\n-->/s);
      let metadata = null;
      if (metadataMatch) {
        try { metadata = JSON.parse(metadataMatch[1]); } catch { }
      }
      const displayBody = discussion.body.replace(/<!-- FEEDBACK_METADATA.*?-->/s, '').trim();
      const htmlBody = marked(displayBody);
      const cleanTitle = discussion.title.replace(/\[slug:[^\]]+\]\s*/g, '').trim();
      return {
        id: discussion.id,
        title: cleanTitle,
        body: htmlBody,
        originalBody: discussion.body,
        url: discussion.url,
        closed: discussion.closed,
        createdAt: discussion.createdAt,
        updatedAt: discussion.updatedAt,
        author: discussion.author,
        commentCount: discussion.comments.totalCount,
        reactionCount: discussion.reactions.totalCount,
        repository: discussion.repository.nameWithOwner,
        metadata,
      };
    });
    return {
      slug: pageSlug,
      discussions,
      total: data?.data?.search?.discussionCount || discussions.length,
    };
  }

  async createDiscussion(options: CreateInput): Promise<CreateResult> {
    const [owner, name] = this.githubRepo.split('/');
    const qRepo = `
    query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) {
        id
        discussionCategories(first: 50) { nodes { id name isAnswerable } }
      }
    }
  `;
    const repoResp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.userToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback'
      },
      body: JSON.stringify({ query: qRepo, variables: { owner, name } })
    });
    if (!repoResp.ok) {
      const txt = await repoResp.text().catch(() => '');
      throw new Error(`repo_access:${repoResp.status}:${txt}`);
    }
    const repoData = await repoResp.json();
    const repository = repoData?.data?.repository;
    if (!repository?.id) throw new Error('repo_access:repository_not_found_or_no_permissions');
    const categories = repository.discussionCategories?.nodes || [];
    const prefName = ''; // TODO: category name?
    let category = categories.find((c: any) => c.name === prefName) ||
      categories.find((c: any) => /Q&A|General|Ideas/i.test(c.name)) ||
      categories.find((c: any) => c.isAnswerable) ||
      categories[0];
    if (!category) throw new Error('no_category:enable_discussions_and_add_a_category');

    const title = buildTitle(options.slug, options.message);
    const composed = buildBody(options.slug, options.selectionText, options.message);

    const mCreate = `
    mutation($repositoryId: ID!, $categoryId: ID!, $title: String!, $body: String!) {
      createDiscussion(input: { repositoryId: $repositoryId, categoryId: $categoryId, title: $title, body: $body }) {
        discussion { id url title createdAt author { login avatarUrl } }
      }
    }
  `;
    const createResp = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.userToken}`,
        'Content-Type': 'application/json',
        'User-Agent': 'fluxzero-docs-feedback'
      },
      body: JSON.stringify({ query: mCreate, variables: { repositoryId: repository.id, categoryId: category.id, title, body: composed } })
    });
    const createData: any = await createResp.json();
    if (!createResp.ok || createData.errors) {
      throw new Error(`create_failed:${createResp.status}:${JSON.stringify(createData.errors || {})}`);
    }
    return { created: createData.data.createDiscussion.discussion };
  }
}
