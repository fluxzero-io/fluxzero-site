import { marked } from 'marked';
import type { FeedbackProvider, Discussion, ListResult, CreateInput, CreateResult } from './types';

const store: Map<string, Discussion[]> = new Map();

export class MemoryProvider implements FeedbackProvider {
  async listDiscussions(slug: string): Promise<ListResult> {
    const arr = store.get(slug) || [];
    return { slug, discussions: arr, total: arr.length };
  }

  async createDiscussion(options: CreateInput): Promise<CreateResult> {
    const { slug, selectionText, message } = options;
    const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const selected = String(selectionText || '').trim();
    const userMsg = String(message || '').trim();
    const snippet = (selected || userMsg).replace(/\s+/g, ' ').slice(0, 80);
    const title = `[slug:${slug}] ${snippet}`;
    const rawBody = `## Documentation Feedback

**Page**: [${slug}](${slug})
**Selected Text**:
> ${selected}

## User Feedback
${userMsg}

---
*This feedback was submitted through the documentation site.*

<!-- FEEDBACK_METADATA
${JSON.stringify({ version: 1, page: slug, selection: { text: selected }, timestamp: new Date().toISOString() }, null, 2)}
-->`;
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
