type FeedbackAuthor = { login: string; avatarUrl: string };
export type FeedbackDiscussion = {
  id: string;
  title: string;
  body: string;
  url: string;
  createdAt: string;
  updatedAt: string;
  author: FeedbackAuthor;
  commentCount: number;
  reactionCount: number;
  repository: string;
  closed: boolean;
  metadata?: any;
};

export type FeedbackState = {
  slug: string | null;
  discussions: FeedbackDiscussion[];
  total: number;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;
};

type Listener = (state: FeedbackState) => void;

const state: FeedbackState = {
  slug: null,
  discussions: [],
  total: 0,
  loading: false,
  error: null,
  lastFetched: null,
};

const listeners = new Set<Listener>();
let pendingRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const canonicalSlug = (value?: string | null) => {
  if (!value) return '/';
  const slug = value.trim();
  if (!slug) return '/';
  return slug.startsWith('/') ? slug : `/${slug}`;
};

function emit() {
  const snapshot = { ...state, discussions: [...state.discussions] };
  try { console.debug('[FloatingFeedback]', 'store:emit', { slug: snapshot.slug, count: snapshot.discussions.length, loading: snapshot.loading }); } catch {}
  listeners.forEach((fn) => {
    try { fn(snapshot); } catch {}
  });
}

function set(partial: Partial<FeedbackState>) {
  Object.assign(state, partial);
  emit();
}

export function getState(): FeedbackState { return { ...state, discussions: [...state.discussions] }; }
export function subscribe(fn: Listener) { listeners.add(fn); fn(getState()); return () => listeners.delete(fn); }

export async function refresh() {
  if (!state.slug) return;
  try {
    try { console.debug('[FloatingFeedback]', 'refresh:start', state.slug); } catch {}
    set({ loading: true, error: null });
    const res = await fetch(`/api/feedback?slug=${encodeURIComponent(state.slug)}`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const data = await res.json();
    set({
      discussions: Array.isArray(data.discussions) ? data.discussions : [],
      total: data.total ?? 0,
      loading: false,
      error: null,
      lastFetched: Date.now(),
    });
    try { console.debug('[FloatingFeedback]', 'refresh:ok', state.slug, (data.discussions || []).length); } catch {}
  } catch (e: any) {
    set({ loading: false, error: e?.message || 'Failed to load feedback' });
    try { console.debug('[FloatingFeedback]', 'refresh:error', state.slug, e); } catch {}
  }
}

export async function submitFeedback(payload: { slug?: string; selection: any; message: string }) {
  const slug = canonicalSlug(payload.slug || state.slug);
  if (!slug) throw new Error('Missing feedback slug');

  set({ slug, loading: true, error: null });

  let response: Response;
  try {
    try { console.debug('[FloatingFeedback]', 'submit:start', slug); } catch {}
    response = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, selection: payload.selection, message: payload.message }),
    });
  } catch (err: any) {
    set({ loading: false, error: err?.message || 'Failed to submit feedback' });
    try { console.debug('[FloatingFeedback]', 'submit:error', slug, err); } catch {}
    throw err;
  }

  if (response.status === 401) {
    set({ loading: false });
    try { console.debug('[FloatingFeedback]', 'submit:unauthorized', slug); } catch {}
    return { ok: false, status: 401 };
  }

  if (!response.ok) {
    const error = new Error(`Submit failed: ${response.status}`);
    set({ loading: false, error: error.message });
    try { console.debug('[FloatingFeedback]', 'submit:failed', slug, response.status); } catch {}
    throw error;
  }

  let responseBody: any = null;
  try {
    responseBody = await response.json();
  } catch (err) {
    try { console.debug('[FloatingFeedback]', 'submit:parse-skip', slug, err); } catch {}
  }

  let discussions = [...state.discussions];
  let total = state.total;
  let createdDiscussion: FeedbackDiscussion | null = null;

  if (responseBody && responseBody.created && responseBody.created.id) {
    const incoming = responseBody.created;
    const existingIndex = discussions.findIndex((item) => item.id === incoming.id);
    if (existingIndex >= 0) {
      discussions = [...discussions];
      discussions[existingIndex] = incoming;
    } else {
      discussions = [incoming, ...discussions];
      total = Math.max(total + 1, discussions.length);
    }
    createdDiscussion = incoming;
  } else if (responseBody && responseBody.discussion && responseBody.discussion.id) {
    const incoming = responseBody.discussion;
    const existingIndex = discussions.findIndex((item) => item.id === incoming.id);
    if (existingIndex >= 0) {
      discussions = [...discussions];
      discussions[existingIndex] = incoming;
    } else {
      discussions = [incoming, ...discussions];
      total = Math.max(total + 1, discussions.length);
    }
    createdDiscussion = incoming;
  }

  set({
    slug,
    discussions,
    total,
    loading: false,
    error: null,
    lastFetched: Date.now(),
  });

  scheduleDelayedRefresh(slug);
  try { console.debug('[FloatingFeedback]', 'submit:ok', slug); } catch {}
  return { ok: true, status: response.status, discussion: createdDiscussion };
}

export function initFeedbackStore(slug: string) {
  const normalized = canonicalSlug(slug);
  set({ slug: normalized, discussions: [], total: 0, loading: true, error: null });
  // debounce refresh slightly to avoid double fetch when multiple inits
  queueMicrotask(() => { refresh(); });
  return { subscribe, getState, refresh };
}

function scheduleDelayedRefresh(slug: string) {
  if (pendingRefreshTimer) clearTimeout(pendingRefreshTimer);
  pendingRefreshTimer = setTimeout(() => {
    pendingRefreshTimer = null;
    if (canonicalSlug(state.slug) === canonicalSlug(slug)) {
      refresh();
    }
  }, 10_000);
}
