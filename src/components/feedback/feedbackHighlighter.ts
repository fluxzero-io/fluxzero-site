import { subscribe, type FeedbackState } from '/src/components/feedback/feedbackStore.ts';

export function initFeedbackHighlighter(options: { slug: string }) {
  const controller = new FeedbackHighlighterController(options.slug);
  return controller;
}

class FeedbackHighlighterController {
  private slug: string;
  private indicators: Array<{ element: HTMLElement; anchor: HTMLElement }>=[];
  private processed = new Set<string>();
  private unsubscribe: null | (() => void) = null;

  constructor(slug: string) {
    this.slug = slug;
    this.init();
  }

  private async init() {
    // reactive subscribe to store
    this.unsubscribe = subscribe((s) => this.onState(s));
    this.setupScrollResize();
  }

  private onState(state: FeedbackState) {
    // If slug changed, reset
    if (state.slug !== this.slug) {
      this.clearAll();
      this.slug = state.slug || this.slug;
    }
    if (state.loading) return;
    const open = (state.discussions || []).filter((d) => !d.closed);
    open.forEach((d, index) => {
      if (this.processed.has(d.id)) return;
      const selectedText = this.extractSelectedText(d as any);
      const loc = this.findTextInPage(selectedText);
      if (loc) {
        this.createIndicator(d as any, loc, index);
        this.processed.add(d.id);
      }
    });
  }

  private extractSelectedText(discussion: any) {
    if (discussion.metadata?.selection?.text) return discussion.metadata.selection.text;
    const m = discussion.body.match(/>\s*([^\n]+)/);
    return m?.[1] || null;
  }

  private findTextInPage(selectedText: string | null) {
    if (!selectedText) return null as const;
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = (node as any).parentElement as HTMLElement | null;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      } as any
    );

    let node: any;
    while ((node = walker.nextNode())) {
      const text: string = node.textContent;
      const index = text.indexOf(selectedText);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + selectedText.length);
        return { range, rect: range.getBoundingClientRect(), element: node.parentElement as HTMLElement, text: selectedText };
      }
    }
    return null as const;
  }

  private createIndicator(discussion: any, textLocation: any, index: number) {
    const span = document.createElement('span');
    span.className = 'feedback-highlight';
    (span as any).dataset.feedbackId = discussion.id;
    (span as any).dataset.feedbackIndex = String(index);
    const range: Range = textLocation.range;
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);

    const indicator = document.createElement('div');
    indicator.className = 'feedback-indicator';
    (indicator as any).dataset.discussionId = discussion.id;
    indicator.innerHTML = `<div class="feedback-badge">💬 ${discussion.commentCount || 0}</div>`;

    this.updateAbsolutePosition(indicator, span);

      indicator.addEventListener('click', (e) => {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('feedback:open-id', { detail: { id: discussion.id, discussion } }));
      });

    indicator.style.opacity = '0';
    indicator.style.pointerEvents = 'none';
    let hideTimeout: any;
    const hide = () => {
      indicator.style.opacity = '0';
      indicator.style.pointerEvents = 'none';
      indicator.style.transform = 'scale(0.8)';
    };
    const show = () => {
      clearTimeout(hideTimeout);
      indicator.style.opacity = '0.8';
      indicator.style.pointerEvents = 'auto';
      indicator.style.transform = 'scale(1)';
    };
    const scheduleHide = (delay = 200) => {
      clearTimeout(hideTimeout);
      hideTimeout = setTimeout(hide, delay);
    };
    span.addEventListener('mouseenter', show);
    span.addEventListener('mouseleave', () => scheduleHide(300));
    indicator.addEventListener('mouseenter', () => { clearTimeout(hideTimeout); indicator.style.opacity = '1'; indicator.style.transform = 'scale(1.1)'; });
    indicator.addEventListener('mouseleave', () => scheduleHide(100));

    document.body.appendChild(indicator);
    this.indicators.push({ element: indicator, anchor: span });
  }

  private clearAll() {
    this.processed.clear();
    this.indicators.forEach(({ element }) => element.remove());
    this.indicators = [];
    // Remove highlights (optional, conservative: keep text wrapped)
  }

  private updateAbsolutePosition(indicator: HTMLElement, anchor: HTMLElement) {
    const rect = anchor.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    indicator.style.position = 'absolute';
    indicator.style.left = `${rect.right + scrollLeft + 10}px`;
    indicator.style.top = `${rect.top + scrollTop + rect.height / 2 - 12}px`;
    indicator.style.zIndex = '1000';
  }

  private setupScrollResize() {
    let ticking = false;
    const update = () => {
      this.indicators.forEach(({ element, anchor }) => this.updateAbsolutePosition(element, anchor));
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    });
  }
}
