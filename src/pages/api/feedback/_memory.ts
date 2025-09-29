import { marked } from 'marked';
import type { FeedbackProvider, Discussion, ListResult, CreateInput, CreateResult } from './types';
import { buildTitle, buildBody } from './util';

const store: Map<string, Discussion[]> = new Map();

export class MemoryProvider implements FeedbackProvider {
  async listDiscussions(slug: string): Promise<ListResult> {
    const arr = store.get(slug) || [];
    return { slug, discussions: arr, total: arr.length };
  }

  async createDiscussion(options: CreateInput): Promise<CreateResult> {
    const { slug, selectionText, message } = options;
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const title = buildTitle(slug, message);
    const rawBody = buildBody(slug, selectionText, message);
    const discussion: Discussion = {
      id,
      title,
      body: marked(rawBody),
      url: '#',
      closed: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { login: 'local-user', avatarUrl: 'https://www.gravatar.com/avatar/?d=identicon' },
      commentCount: 0,
      reactionCount: 0,
      repository: 'local/memory',
      metadata: { version: 1, page: slug, selection: { text: selected } },
    };
    const arr = store.get(slug) || [];
    arr.unshift(discussion);
    store.set(slug, arr);
    return { created: discussion };
  }
}
