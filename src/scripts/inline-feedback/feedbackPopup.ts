import { sanitizeHtml } from './sanitize.ts';

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
    this.showPopup(discussion, anchorEl || document.body, clientX, clientY);
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

  private showPopup(discussion: any, indicator: HTMLElement, clickX?: number, clickY?: number) {
    if (this.activePopup) this.activePopup.remove();

    const popup = document.createElement('div');
    popup.className = 'feedback-popup';
    const messageHtml = sanitizeHtml(this.extractUserFeedbackHtml(discussion) || '<p>No feedback message provided.</p>');
    const commentCount = Number(discussion?.commentCount ?? 0);
    const commentLabel = `${commentCount} ${commentCount === 1 ? 'comment' : 'comments'}`;

    const header = document.createElement('div');
    header.className = 'feedback-popup-header';

    const heading = document.createElement('h4');
    heading.textContent = String(discussion.title || 'Feedback');

    const closeButton = document.createElement('button');
    closeButton.className = 'feedback-close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';

    header.append(heading, closeButton);

    const content = document.createElement('div');
    content.className = 'feedback-popup-content';

    const authorWrap = document.createElement('div');
    authorWrap.className = 'feedback-author';

    const avatarUrl = safeHttpUrl(discussion?.author?.avatarUrl);
    if (avatarUrl) {
      const avatar = document.createElement('img');
      avatar.src = avatarUrl;
      avatar.alt = String(discussion?.author?.login || 'User');
      avatar.width = 24;
      avatar.height = 24;
      authorWrap.append(avatar);
    }

    const authorName = document.createElement('span');
    authorName.textContent = String(discussion?.author?.login || 'Unknown');

    const time = document.createElement('time');
    time.textContent = this.formatDate(discussion.createdAt);

    authorWrap.append(authorName, time);

    const body = document.createElement('div');
    body.className = 'feedback-body feedback-user-message';
    body.innerHTML = messageHtml;

    const actions = document.createElement('div');
    actions.className = 'feedback-actions';

    const discussionLink = document.createElement('a');
    const discussionUrl = safeHttpUrl(discussion.url);
    if (discussionUrl) {
      discussionLink.href = discussionUrl;
      discussionLink.target = '_blank';
      discussionLink.rel = 'noopener noreferrer';
    }
    discussionLink.textContent = `View full discussion (${commentLabel}) →`;

    actions.append(discussionLink);
    content.append(authorWrap, body, actions);

    popup.append(header, content);

    popup.style.position = 'absolute';
    popup.style.zIndex = '2000';
    popup.style.visibility = 'hidden';
    (popup as any).associatedIndicator = indicator;
    document.body.appendChild(popup);
    // Now that it's in the DOM, measure and position near the cursor (top-right, 20px offset)
    this.updatePopupPosition(popup, indicator, clickX, clickY);
    popup.style.visibility = 'visible';

    const close = () => {
      document.removeEventListener('click', onOutside);
      popup.remove();
      this.activePopup = null;
      indicator.style.opacity = '0';
      indicator.style.transform = 'scale(0.8)';
    };
    closeButton.addEventListener('click', close);

    const onOutside = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && e.target !== indicator && !(indicator as any).contains(e.target)) {
        close();
      }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 100);

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
    const header = document.createElement('div');
    header.className = 'feedback-popup-header';

    const heading = document.createElement('h4');
    heading.textContent = `${discussions.length} discussions`;

    const closeButton = document.createElement('button');
    closeButton.className = 'feedback-close';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.textContent = '×';

    header.append(heading, closeButton);

    const content = document.createElement('div');
    content.className = 'feedback-popup-content';

    const itemsRoot = document.createElement('div');
    itemsRoot.className = 'feedback-items';

    discussions.forEach((d) => {
      const item = document.createElement('div');
      item.className = 'feedback-item';
      item.dataset.id = d.id;

      const link = document.createElement('a');
      link.href = '#';
      link.className = 'feedback-item-link';
      link.dataset.id = d.id;

      const meta = document.createElement('span');
      meta.className = 'feedback-meta';
      meta.textContent = new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      const title = document.createElement('span');
      title.className = 'feedback-title';
      title.textContent = `${d.closed ? '✅' : '💬'} ${d.title || ''}`.trim();

      link.append(meta, title);
      item.append(link);
      itemsRoot.append(item);
    });

    content.append(itemsRoot);
    popup.append(header, content);
    popup.style.position = 'absolute';
    popup.style.zIndex = '2000';
    popup.style.visibility = 'hidden';
    (popup as any).associatedIndicator = indicator;
    document.body.appendChild(popup);
    this.updatePopupPosition(popup, indicator, clickX, clickY);
    popup.style.visibility = 'visible';
    this.updatePopupPosition(popup, indicator, clickX, clickY);
    popup.style.visibility = 'visible';

    const closePopup = () => {
      document.removeEventListener('click', onOutside);
      popup.remove();
      this.activePopup = null;
    };

    closeButton.addEventListener('click', closePopup);

    const onOutside = (e: MouseEvent) => {
      if (!popup.contains(e.target as Node) && e.target !== indicator && !(indicator as any).contains(e.target)) {
        closePopup();
      }
    };
    setTimeout(() => document.addEventListener('click', onOutside), 100);

    itemsRoot.querySelectorAll('.feedback-item-link').forEach((el) => {
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        const id = (ev.currentTarget as HTMLElement).dataset.id!;
        const d = discussions.find(x => x.id === id) || discussions[0];
        closePopup();
        this.showPopup(d, indicator);
      });
    });
    requestAnimationFrame(() => popup.classList.add('is-visible'));
    this.activePopup = popup;
  }

  private updatePopupPosition(popup: HTMLElement, indicator: HTMLElement, clickX?: number, clickY?: number) {
    const rect = indicator.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
    const docHeight = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    const offset = 20;
    const popupRect = popup.getBoundingClientRect();
    const popupWidth = Math.min(440, Math.max(280, popupRect.width || 360));
    const popupHeight = Math.min(420, Math.max(180, popupRect.height || 320));

    let left = (typeof clickX === 'number')
      ? clickX + scrollX + offset
      : rect.right + scrollX + offset;
    let top = (typeof clickY === 'number')
      ? clickY + scrollY - popupHeight - offset
      : rect.top + scrollY - popupHeight - offset;

    if (top < scrollY + 10) {
      top = rect.bottom + scrollY + offset;
    }

    const maxLeft = docWidth - popupWidth - 10;
    if (left > maxLeft) left = maxLeft;
    if (left < scrollX + 10) left = scrollX + 10;

    const maxTop = docHeight - popupHeight - 10;
    if (top > maxTop) top = maxTop;
    if (top < scrollY + 10) top = scrollY + 10;

    popup.style.left = `${Math.round(left)}px`;
    popup.style.top = `${Math.round(top)}px`;
    popup.style.width = `${popupWidth}px`;
  }

  private formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }

  private extractUserFeedbackHtml(discussion: any) {
    const html = discussion?.body || discussion?.originalBody || '';
    if (!html) return '';
    const container = document.createElement('div');
    container.innerHTML = html;
    const heading = Array.from(container.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .find((el) => el.textContent?.trim().toLowerCase() === 'user feedback');
    if (heading) {
      const frag = document.createElement('div');
      let next = heading.nextElementSibling;
      while (next && !/^H[1-6]$/.test(next.tagName)) {
        frag.appendChild(next.cloneNode(true));
        next = next.nextElementSibling;
      }
      const content = frag.innerHTML.trim();
      if (content) return content;
    }
    // fallback: return paragraph content if structured differently
    const paragraphs = Array.from(container.querySelectorAll('p'));
    if (paragraphs.length) {
      return paragraphs.map((p) => p.outerHTML).join('');
    }
    return container.textContent || '';
  }
}

function safeHttpUrl(url: any): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return '';
}
