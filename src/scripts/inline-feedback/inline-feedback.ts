import { initFeedbackList } from './feedbackList.ts';
import { initFeedbackHighlighter } from './feedbackHighlighter.ts';
import { initFeedbackPopup } from './feedbackPopup.ts';
import { getState, initFeedbackStore, refresh } from './feedbackStore.ts';
import { SelectionPromptController } from './selectionPrompt.ts';

const initialized = new WeakSet<HTMLElement>();
let popupInitialized = false;
let reloadListenerAttached = false;
let activeSlug: string | null = null;

const normalizeSlug = (value: string | null | undefined) => {
  if (!value) return window.location.pathname;
  const trimmed = value.trim();
  if (!trimmed) return window.location.pathname;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
};

const ensureStore = (slug: string) => {
  const normalized = normalizeSlug(slug);
  if (activeSlug === normalized) return;
  const state = getState();
  if (state.slug !== normalized) {
    initFeedbackStore(normalized);
  }
  activeSlug = normalized;
};

const initElement = (el: HTMLElement) => {
  if (initialized.has(el)) return;
  const slugAttr = el.getAttribute('inline-feedback');
  const slug = normalizeSlug(slugAttr);

  ensureStore(slug);

  const rootId = el.dataset.inlineFeedbackRoot || '';
  const mountId = el.id || '';
  let root: HTMLElement | undefined;
  if (rootId) {
    const rootCandidate = document.getElementById(rootId);
    if (rootCandidate instanceof HTMLElement) {
      root = rootCandidate;
    }
  }
  if (!root && el.parentElement instanceof HTMLElement) {
    root = el.parentElement;
  }

  initFeedbackList({ slug, mount: el });
  initFeedbackHighlighter({ slug, root });

  if (!popupInitialized) {
    initFeedbackPopup();
    popupInitialized = true;
  }

  if (!reloadListenerAttached) {
    window.addEventListener('feedback:reload', () => {
      try {
        refresh();
      } catch {}
    });
    reloadListenerAttached = true;
  }

  const controller = new SelectionPromptController(rootId ? `#${rootId}` : '', mountId);
  controller.restoreFromSession();

  initialized.add(el);
};

const bootstrap = () => {
  const elements = document.querySelectorAll<HTMLElement>('[inline-feedback]');
  elements.forEach((el) => initElement(el));
};

if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
}
