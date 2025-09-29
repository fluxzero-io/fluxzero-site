export function initFeedbackPopup() {
  const controller = new FeedbackPopupController();
  return controller;
}

class FeedbackPopupController {
  private activePopup: HTMLElement | null = null;

  constructor() {
    this.onOpen = this.onOpen.bind(this);
    this.onOpenGroup = this.onOpenGroup.bind(this);
    window.addEventListener('feedback:open-id', this.onOpen);
    window.addEventListener('feedback:open-group', this.onOpenGroup);
    this.setupReposition();
  }

  private onOpen(e: CustomEvent) {
    const id = (e as any).detail?.id as string | undefined;
    const discussion = (e as any).detail?.discussion as any | undefined;
    const clientX = (e as any).detail?.clientX as number | undefined;
    const clientY = (e as any).detail?.clientY as number | undefined;
    if (!id || !discussion) return;
    const highlightSpan = this.findHighlightSpanById(id);
    const indicator = document.querySelector(`.feedback-indicator[data-discussion-id="${id}"]`) as HTMLElement | null;
    const anchorEl = indicator || highlightSpan;
    if (anchorEl) anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Small delay to allow scroll positioning, but keep snappy
    setTimeout(() => this.showPopup(discussion, anchorEl || document.body, clientX, clientY), 60);
  }

  private findHighlightSpanById(id: string): HTMLElement | null {
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

  private setupReposition() {
    let ticking = false;
    const update = () => {
      if (this.activePopup && (this.activePopup as any).associatedIndicator) {
        const indicator = (this.activePopup as any).associatedIndicator as HTMLElement;
        this.updatePopupPosition(this.activePopup, indicator);
      }
      ticking = false;
    };
    window.addEventListener('scroll', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    }, { passive: true });
    window.addEventListener('resize', () => {
      if (!ticking) { requestAnimationFrame(update); ticking = true; }
    });
  }

  private showPopup(discussion: any, indicator: HTMLElement, clickX?: number, clickY?: number) {
    if (this.activePopup) this.activePopup.remove();

    const popup = document.createElement('div');
    popup.className = 'feedback-popup';
    popup.innerHTML = `
      <div class="feedback-popup-header">
        <h4>${discussion.title}</h4>
        <button class="feedback-close" aria-label="Close">&times;</button>
      </div>
      <div class="feedback-popup-content">
        <div class="feedback-author">
          <img src="${discussion.author.avatarUrl}" alt="${discussion.author.login}" width="24" height="24">
          <span>${discussion.author.login}</span>
          <time>${this.formatDate(discussion.createdAt)}</time>
        </div>
        <div class="feedback-selected-text">
          <strong>About:</strong> "${this.extractSelectedText(discussion)}"
        </div>
        <div class="feedback-body">
          ${discussion.body.slice(0, 300)}${discussion.body.length > 300 ? '...' : ''}
        </div>
        <div class="feedback-actions">
          <a href="${discussion.url}" target="_blank" rel="noopener noreferrer">
            View full discussion →
          </a>
        </div>
      </div>
    `;

    popup.style.position = 'fixed';
    popup.style.zIndex = '2000';
    popup.style.visibility = 'hidden';
    (popup as any).associatedIndicator = indicator;
    document.body.appendChild(popup);
    // Now that it's in the DOM, measure and position near the cursor (top-right, 20px offset)
    this.updatePopupPosition(popup, indicator, clickX, clickY);
    popup.style.visibility = 'visible';

    const close = () => {
      popup.remove();
      this.activePopup = null;
      indicator.style.opacity = '0';
      indicator.style.transform = 'scale(0.8)';
    };
    popup.querySelector('.feedback-close')?.addEventListener('click', close);

    setTimeout(() => {
      const onOutside = (e: MouseEvent) => {
        if (!popup.contains(e.target as Node) && e.target !== indicator && !(indicator as any).contains(e.target)) {
          close();
          document.removeEventListener('click', onOutside);
        }
      };
      document.addEventListener('click', onOutside);
    }, 100);

    // Trigger enter animation
    requestAnimationFrame(() => {
      popup.classList.add('is-visible');
    });
    this.activePopup = popup;
  }

  private onOpenGroup(e: CustomEvent) {
    const discussions = (e as any).detail?.discussions as any[] | undefined;
    const clientX = (e as any).detail?.clientX as number | undefined;
    const clientY = (e as any).detail?.clientY as number | undefined;
    if (!discussions || discussions.length === 0) return;
    // Anchor to first discussion's indicator if present
    const firstId = discussions[0].id;
    const indicator = document.querySelector(`.feedback-indicator[data-discussion-id="${firstId}"]`) as HTMLElement | null;
    const anchorEl = indicator || document.body;
    this.showGroupPopup(discussions, anchorEl, clientX, clientY);
  }

  private showGroupPopup(discussions: any[], indicator: HTMLElement, clickX?: number, clickY?: number) {
    if (this.activePopup) this.activePopup.remove();
    const popup = document.createElement('div');
    popup.className = 'feedback-popup';
    const items = discussions.map((d, i) => `
      <div class="feedback-item" data-id="${d.id}">
        <a href="#" class="feedback-item-link" data-id="${d.id}">
          <span class="feedback-meta">${new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
          <span class="feedback-title">${d.closed ? '✅' : '💬'} ${d.title}</span>
        </a>
      </div>`).join('');
    popup.innerHTML = `
      <div class="feedback-popup-header">
        <h4>${discussions.length} discussions</h4>
        <button class="feedback-close" aria-label="Close">&times;</button>
      </div>
      <div class="feedback-popup-content">
        <div class="feedback-items">${items}</div>
      </div>`;
    popup.style.position = 'fixed';
    popup.style.zIndex = '2000';
    popup.style.visibility = 'hidden';
    (popup as any).associatedIndicator = indicator;
    document.body.appendChild(popup);
    this.updatePopupPosition(popup, indicator, clickX, clickY);
    popup.style.visibility = 'visible';
    popup.querySelector('.feedback-close')?.addEventListener('click', () => { popup.remove(); this.activePopup = null; });
    popup.querySelectorAll('.feedback-item-link').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const id = (ev.currentTarget as HTMLElement).dataset.id!;
        const d = discussions.find(x => x.id === id) || discussions[0];
        popup.remove();
        this.showPopup(d, indicator);
      });
    });
    requestAnimationFrame(() => popup.classList.add('is-visible'));
    this.activePopup = popup;
  }

  private updatePopupPosition(popup: HTMLElement, indicator: HTMLElement, clickX?: number, clickY?: number) {
    const rect = indicator.getBoundingClientRect();
    const offset = 20;
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = Math.min(440, Math.max(280, popupRect.width || 360));
    const popupHeight = Math.min(420, Math.max(180, popupRect.height || 320));

    let left = (typeof clickX === 'number') ? clickX + offset : rect.left;
    // Prefer above the cursor: top-right of cursor by 20px; if not enough space, place below
    let top = (typeof clickY === 'number') ? (clickY - popupHeight - offset) : (rect.bottom + 10);
    if (typeof clickY === 'number' && top < 10) {
      top = clickY + offset; // place below if not enough space above
    }

    // Clamp within viewport horizontally
    if (left + popupWidth > window.innerWidth - 10) left = window.innerWidth - popupWidth - 10;
    if (left < 10) left = 10;
    // Clamp vertically
    if (top + popupHeight > window.innerHeight - 10) top = Math.max(10, window.innerHeight - popupHeight - 10);

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
    popup.style.width = `${popupWidth}px`;
  }

  private formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private extractSelectedText(discussion: any) {
    if (discussion.metadata?.selection?.text) return discussion.metadata.selection.text;
    const m = discussion.body.match(/>\s*([^\n]+)/);
    return m?.[1] || '';
  }
}
