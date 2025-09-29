export type Author = { login: string; avatarUrl: string };

export type Discussion = {
  id: string;
  title: string;
  body: string; // HTML
  url: string;
  closed: boolean;
  createdAt: string;
  updatedAt: string;
  author: Author;
  commentCount: number;
  reactionCount: number;
  repository: string;
  metadata?: any;
};

export type ListResult = { slug: string; discussions: Discussion[]; total: number };
export type CreateInput = { slug: string; selectionText: string; message: string };
export type CreateResult = { created: Discussion | any };

export interface FeedbackProvider {
  listDiscussions(slug: string): Promise<ListResult>;
  createDiscussion(input: CreateInput): Promise<CreateResult>;
}

