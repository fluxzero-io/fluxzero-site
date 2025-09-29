export function initFeedbackPopup() {
  const controller = new FeedbackPopupController();
  return controller;
}

class FeedbackPopupController {
  private activePopup: HTMLElement | null = null;

  constructor() {
    this.onOpen = this.onOpen.bind(this);
    window.addEventListener('feedback:open-id', this.onOpen);
    this.setupReposition();
  }

  private onOpen(e: CustomEvent) {
    const id = (e as any).detail?.id as string | undefined;
    const discussion = (e as any).detail?.discussion as any | undefined;
    if (!id || !discussion) return;
    const highlightSpan = document.querySelector(`[data-feedback-id="${id}"]`) as HTMLElement | null;
    const indicator = document.querySelector(`.feedback-indicator[data-discussion-id="${id}"]`) as HTMLElement | null;
    const anchorEl = indicator || highlightSpan;
    if (!anchorEl) return;
    anchorEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Small delay to allow scroll positioning, but keep snappy
    setTimeout(() => this.showPopup(discussion, anchorEl), 60);
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

  private showPopup(discussion: any, indicator: HTMLElement) {
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

    this.updatePopupPosition(popup, indicator);
    popup.style.position = 'fixed';
    popup.style.zIndex = '2000';
    (popup as any).associatedIndicator = indicator;

    const close = () => {
      popup.remove();
      this.activePopup = null;
      indicator.style.opacity = '0';
      (indicator as any).style.pointerEvents = 'none';
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

    document.body.appendChild(popup);
    // Trigger enter animation
    requestAnimationFrame(() => {
      popup.classList.add('is-visible');
    });
    this.activePopup = popup;
  }

  private updatePopupPosition(popup: HTMLElement, indicator: HTMLElement) {
    const rect = indicator.getBoundingClientRect();
    const popupWidth = 440;
    let left = rect.left;
    let top = rect.bottom + 10;
    if (left + popupWidth > window.innerWidth) left = window.innerWidth - popupWidth - 10;
    if (left < 10) left = 10;
    if (top + 400 > window.innerHeight) top = rect.top - 410;
    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
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
