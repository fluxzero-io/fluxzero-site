type FeedbackProvider = 'github-discussions' | 'github-issues' | 'memory';

const SUPPORTED_PROVIDERS: FeedbackProvider[] = ['github-discussions', 'github-issues', 'memory'];

function normalize(value: string | undefined | null): FeedbackProvider | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
  if (candidate === 'github') return 'github-discussions';
  return (SUPPORTED_PROVIDERS as string[]).includes(candidate) ? (candidate as FeedbackProvider) : null;
}

export function getFeedbackProvider(): FeedbackProvider | null {
  return normalize(typeof import.meta.env.FEEDBACK_PROVIDER === 'string' ? import.meta.env.FEEDBACK_PROVIDER : undefined);
}

export function isFeedbackEnabled(): boolean {
  return getFeedbackProvider() !== null;
}

export function getSupportedFeedbackProviders(): readonly FeedbackProvider[] {
  return SUPPORTED_PROVIDERS;
}
