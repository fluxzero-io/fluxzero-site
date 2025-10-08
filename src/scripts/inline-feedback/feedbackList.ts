import { subscribe, getState, type FeedbackState } from './feedbackStore.ts';

export function initFeedbackList(options: { slug: string; mount?: HTMLElement | null }) {
  const controller = new FeedbackListController(options.slug, options.mount || null);
  return controller;
}

class FeedbackListController {
  private slug: string;
  private root: HTMLElement | null;
  private unsubscribe: null | (() => void) = null;
  private isOpen = false;

  constructor(slug: string, mount: HTMLElement | null) {
    this.slug = slug;
    this.root = this.ensureRoot(mount);
    this.init();
  }

  private ensureRoot(mount: HTMLElement | null) {
    const root = document.createElement('div');
    root.className = 'feedback-list-root';
    root.dataset.slug = this.slug;
    (mount || document.body).appendChild(root);
    root.innerHTML = `
      <button class="feedback-button" id="feedback-toggle" aria-expanded="false">
        💬 <span class="feedback-count">0</span>
      </button>
      <div class="feedback-popup-container" id="feedback-popup" style="display:none;">
        <div class="feedback-popup-header">
          <h3>Feedback & Questions</h3>
          <button class="feedback-popup-close" aria-label="Close">&times;</button>
        </div>
        <div class="feedback-list" role="list"></div>
      </div>`;
    return root;
  }

  private async init() {
    // subscribe to store and render reactively
    this.unsubscribe = subscribe((s) => {
      this.renderFromState(s);
    });
    this.setupHandlers();
    window.addEventListener('feedback:highlights-updated', () => {
      try {
        this.updateMissingMarkers();
      } catch {}
    });
  }

  private renderFromState(state: FeedbackState) {
    if (!this.root) return;
    if (!state.slug || state.slug !== this.slug) {
      try { console.debug('[FloatingFeedback]', 'list:skip', { expected: this.slug, received: state.slug }); } catch {}
      return;
    }
    const listEl = this.root.querySelector('.feedback-list') as HTMLElement;
    const btn = this.root.querySelector('.feedback-button') as HTMLElement;
    const countEl = this.root.querySelector('.feedback-count') as HTMLElement;
    const { discussions = [], loading } = state;
    const count = discussions.length || 0;
    try { console.debug('[FloatingFeedback]', 'list:render', { slug: state.slug, loading, count }); } catch {}
    countEl.textContent = String(count);
    if (loading) {
      (btn as any).style.display = 'none';
      listEl.replaceChildren();
      const msg = document.createElement('p');
      msg.className = 'no-feedback';
      msg.textContent = 'Loading feedback…';
      listEl.append(msg);
      try { console.debug('[FloatingFeedback]', 'list:state', 'loading'); } catch {}
      return;
    }
    if (count === 0) {
      (btn as any).style.display = 'block';
      listEl.replaceChildren();
      const msg = document.createElement('p');
      msg.className = 'no-feedback';
      msg.textContent = 'No feedback yet for this page.';
      listEl.append(msg);
      try { console.debug('[FloatingFeedback]', 'list:state', 'empty-visible'); } catch {}
      return;
    }
    (btn as any).style.display = 'block';
    try { console.debug('[FloatingFeedback]', 'list:state', 'visible'); } catch {}
    listEl.replaceChildren();
    const itemsRoot = document.createElement('div');
    itemsRoot.className = 'feedback-items';

    [...discussions]
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((d: any) => {
        const item = document.createElement('div');
        item.className = 'feedback-item';

        const link = document.createElement('a');
        link.className = 'feedback-item-link';
        link.dataset.id = d.id;
        link.dataset.closed = d.closed ? 'true' : 'false';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        const safeUrl = typeof d.url === 'string' && /^https?:\/\//i.test(d.url) ? d.url : '#';
        link.href = safeUrl;

        const date = new Date(d.createdAt);
        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const timeStr = date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
        const statusIcon = d.closed ? '✅' : '💬';
        const comments = Number(d.commentCount ?? 0);
        const commentLabel = ` • ${comments} ${comments === 1 ? 'comment' : 'comments'}`;
        const authorName = (d.author && d.author.login) ? d.author.login : 'Anonymous';
        const metaSpan = document.createElement('span');
        metaSpan.className = 'feedback-meta';
        metaSpan.textContent = `${dateStr} ${timeStr} • ${authorName}${commentLabel}`;

        const titleSpan = document.createElement('span');
        titleSpan.className = 'feedback-title';
        titleSpan.textContent = `${statusIcon} ${d.title || ''}`.trim();

        link.append(metaSpan, titleSpan);
        item.append(link);
        itemsRoot.append(item);
      });

    listEl.append(itemsRoot);
    const current = discussions;

    // Defer marking to after highlights update
    setTimeout(() => { try { this.updateMissingMarkers(); } catch {} }, 0);
    listEl.querySelectorAll('.feedback-item-link').forEach((linkEl) => {
      linkEl.addEventListener('click', (e) => {
        const link = e.currentTarget as HTMLElement;
        const id = (link as any).dataset.id;
        if (!id) return;
        const discussion = current.find((d) => d.id === id);
        const anchor = findHighlightSpanById(id);
        if (anchor) {
          e.preventDefault();
          // Scroll highlight into view before opening details
          (anchor as any).scrollIntoView({ behavior: 'smooth', block: 'center' });
          // Close the list popup while opening single-item popup
          const popup = this.root?.querySelector('#feedback-popup') as HTMLElement | null;
          const btn = this.root?.querySelector('.feedback-button') as HTMLElement | null;
          if (popup && btn) {
            popup.style.display = 'none';
            btn.setAttribute('aria-expanded', 'false');
            this.isOpen = false;
          }
          setTimeout(() => emitOpenEvent(id, discussion, anchor), 260);
        }
      });
    });
  }

  private updateMissingMarkers() {
    if (!this.root) return;
    const listEl = this.root.querySelector('.feedback-list') as HTMLElement;
    listEl.querySelectorAll('.feedback-item-link').forEach((link) => {
      // reset
      (link as HTMLElement).classList.remove('is-missing');
      const old = (link as HTMLElement).querySelector('.feedback-missing-badge');
      if (old) old.remove();
      const id = (link as HTMLElement).dataset.id || '';
      const anchor = findHighlightSpanById(id);
      const isClosed = (link as HTMLElement).dataset.closed === 'true';
      if (!anchor && !isClosed) {
        (link as HTMLElement).classList.add('is-missing');
        const badge = document.createElement('span');
        badge.className = 'feedback-missing-badge';
        badge.textContent = 'not found on page';
        (link as HTMLElement).appendChild(badge);
      }
    });
  }

  private setupHandlers() {
    if (!this.root) return;
    const btn = this.root.querySelector('.feedback-button') as HTMLElement;
    const popup = this.root.querySelector('#feedback-popup') as HTMLElement;
    const close = this.root.querySelector('.feedback-popup-close') as HTMLElement;
    const setOpen = (open: boolean) => {
      this.isOpen = open;
      (popup as any).style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', String(open));
    };
    btn.addEventListener('click', () => setOpen(!this.isOpen));
    close.addEventListener('click', () => setOpen(false));
    document.addEventListener('click', (e) => {
      if (this.isOpen && !popup.contains(e.target as Node) && !btn.contains(e.target as Node)) {
        setOpen(false);
      }
    });
  }
}

function findHighlightSpanById(id: string): HTMLElement | null {
  try {
    const spans = document.querySelectorAll('span.feedback-highlight[data-feedback-highlight="true"]');
    for (const el of Array.from(spans)) {
      const ds = (el as any).dataset || {};
      if (!ds.feedbackIds) continue;
      try {
        const arr = JSON.parse(ds.feedbackIds);
        if (Array.isArray(arr) && arr.includes(id)) return el as HTMLElement;
      } catch {}
    }
  } catch {}
  return null;
}

function emitOpenEvent(id: string, discussion: any, anchor: HTMLElement) {
  const rect = anchor.getBoundingClientRect();
  const clientX = rect.left + rect.width;
  const clientY = rect.top + rect.height / 2;
  window.dispatchEvent(
    new CustomEvent('feedback:open-id', {
      detail: { id, discussion, clientX, clientY },
    }),
  );
}

// No registry: anchors are discovered by scanning highlight spans
