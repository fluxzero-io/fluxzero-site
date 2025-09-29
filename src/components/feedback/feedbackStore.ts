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

function emit() {
  listeners.forEach((fn) => {
    try { fn({ ...state, discussions: [...state.discussions] }); } catch {}
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
  } catch (e: any) {
    set({ loading: false, error: e?.message || 'Failed to load feedback' });
  }
}

export function initFeedbackStore(slug: string) {
  if (state.slug !== slug) {
    set({ slug, discussions: [], total: 0, loading: false, error: null, lastFetched: null });
  }
  // debounce refresh slightly to avoid double fetch when multiple inits
  queueMicrotask(() => { refresh(); });
  return { subscribe, getState, refresh };
}

