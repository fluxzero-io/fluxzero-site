type FeedbackProvider = 'github' | 'memory';

const SUPPORTED_PROVIDERS: FeedbackProvider[] = ['github', 'memory'];

function normalize(value: string | undefined | null): FeedbackProvider | null {
  if (!value) return null;
  const candidate = value.trim().toLowerCase();
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
