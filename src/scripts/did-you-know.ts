/**
 * Did You Know popover controller
 *
 * Manages the display of "Did You Know" popovers.
 * Finds all elements with data-didyouknow="{id}" attributes and shows them one by one
 * as a popover near the mouse cursor after a configurable delay.
 */

interface DidYouKnowData {
  id: string;
  message: string;
  delay: number;
}

class DidYouKnowController {
  private tips: DidYouKnowData[] = [];
  private currentIndex: number = 0;
  private popover: HTMLElement | null = null;
  private storageKey: string = 'didyouknow-dismissed';
  private mouseX: number | null = null;
  private mouseY: number | null = null;
  private showTimeout: number | null = null;

  constructor() {
    this.init();
  }

  private init(): void {
    // Find all Did You Know data elements
    const dataElements = document.querySelectorAll<HTMLElement>('[data-didyouknow]');

    this.tips = Array.from(dataElements).map(el => ({
      id: el.dataset.didyouknow!,
      message: el.dataset.didyouknowMessage || '',
      delay: parseInt(el.dataset.didyouknowDelay || '3000', 10)
    }));

    // Hide data elements (they're just for data storage)
    dataElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });

    if (this.tips.length === 0) {
      return;
    }

    // Track mouse position
    document.addEventListener('mousemove', (e) => {
      this.mouseX = e.clientX;
      this.mouseY = e.clientY;
    });

    // Create the popover element
    this.createPopover();

    // Schedule the first non-dismissed tip
    this.scheduleNext();
  }

  private createPopover(): void {
    this.popover = document.createElement('div');
    this.popover.className = 'did-you-know-popup';
    this.popover.innerHTML = `
      <div class="did-you-know-popup-header">
        <h4>💡 Did you know?</h4>
        <button class="did-you-know-close" aria-label="Close">×</button>
      </div>
      <div class="did-you-know-popup-content">
        <div class="did-you-know-message"></div>
      </div>
    `;

    // Add styles matching feedback popup
    const style = document.createElement('style');
    style.textContent = `
      .did-you-know-popup {
        position: fixed;
        width: 420px;
        max-width: calc(100vw - 24px);
        max-height: 400px;
        overflow: hidden;
        background: var(--sl-color-bg, #ffffff);
        border: 1px solid var(--sl-color-gray-6, #e5e7eb);
        border-radius: 8px;
        box-shadow: 0 10px 25px rgba(0,0,0,.15);
        color: var(--sl-color-text, #1f2937);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        z-index: 2000;
        opacity: 0;
        transform: translateY(6px) scale(.98);
        transition: opacity .16s ease, transform .18s ease;
      }

      .did-you-know-popup.is-visible {
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      .did-you-know-popup-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: var(--sl-color-bg-nav, #f8fafc);
        border-bottom: 1px solid var(--sl-color-gray-5, #e2e8f0);
      }

      .did-you-know-popup-header h4 {
        margin: 0;
        font-size: 14px;
        font-weight: 600;
        color: var(--sl-color-text, #111827);
        flex: 1;
        margin-right: 12px;
      }

      .did-you-know-close {
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: var(--sl-color-text-accent, #6b7280);
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: all .2s ease;
      }

      .did-you-know-close:hover {
        color: var(--sl-color-text, #1f2937);
        background: #e2e8f0;
      }

      .did-you-know-popup-content {
        padding: 16px;
      }

      .did-you-know-message {
        font-size: 14px;
        line-height: 1.6;
        color: var(--sl-color-text, #1f2937);
      }

      /* Dark mode */
      @media (prefers-color-scheme: dark) {
        .did-you-know-popup {
          background: #1f2937;
          border-color: #374151;
          color: #f9fafb;
        }

        .did-you-know-popup-header {
          background: #111827;
          border-color: #374151;
        }

        .did-you-know-popup-header h4 {
          color: #f9fafb;
        }

        .did-you-know-close {
          color: #9ca3af;
        }

        .did-you-know-close:hover {
          color: #f9fafb;
          background: #374151;
        }

        .did-you-know-message {
          color: #f9fafb;
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(this.popover);

    // Set up close button handler
    const closeButton = this.popover.querySelector('.did-you-know-close');
    if (closeButton) {
      closeButton.addEventListener('click', () => {
        this.dismissCurrent();
      });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
      if (this.popover &&
          this.popover.classList.contains('is-visible') &&
          !this.popover.contains(e.target as Node)) {
        this.dismissCurrent();
      }
    });
  }

  private getDismissedIds(): string[] {
    try {
      const stored = localStorage.getItem(this.storageKey);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveDismissedId(id: string): void {
    try {
      const dismissed = this.getDismissedIds();
      if (!dismissed.includes(id)) {
        dismissed.push(id);
        localStorage.setItem(this.storageKey, JSON.stringify(dismissed));
      }
    } catch {
      // localStorage not available, ignore
    }
  }

  private dismissCurrent(): void {
    const currentTip = this.tips[this.currentIndex];
    if (currentTip && this.popover) {
      this.popover.classList.remove('is-visible');
      this.saveDismissedId(currentTip.id);
      this.currentIndex++;

      // Schedule next tip
      this.scheduleNext();
    }
  }

  private findNextTipIndex(): number {
    const dismissedIds = this.getDismissedIds();

    for (let i = this.currentIndex; i < this.tips.length; i++) {
      if (!dismissedIds.includes(this.tips[i].id)) {
        return i;
      }
    }

    return -1;
  }

  private scheduleNext(): void {
    // Clear any existing timeout
    if (this.showTimeout !== null) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    const nextIndex = this.findNextTipIndex();
    if (nextIndex === -1) {
      return; // No more tips to show
    }

    this.currentIndex = nextIndex;
    const tip = this.tips[nextIndex];

    this.showTimeout = window.setTimeout(() => {
      this.showTip(tip);
    }, tip.delay);
  }

  private showTip(tip: DidYouKnowData): void {
    if (!this.popover) return;

    const messageEl = this.popover.querySelector('.did-you-know-message');
    if (messageEl) {
      messageEl.textContent = tip.message;
    }

    // Position near the mouse cursor
    this.positionPopover();

    // Trigger enter animation
    requestAnimationFrame(() => {
      this.popover?.classList.add('is-visible');
    });
  }

  private positionPopover(): void {
    if (!this.popover) return;

    const popupWidth = 420;
    const popupHeight = 150; // Approximate height

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;
    const offset = 20;

    // If no mouse position tracked, center the popover
    if (this.mouseX === null || this.mouseY === null) {
      const x = (viewportWidth - popupWidth) / 2;
      const y = (viewportHeight - popupHeight) / 2;
      this.popover.style.left = `${x}px`;
      this.popover.style.top = `${y}px`;
      return;
    }

    // Position relative to cursor (top-right of cursor, like feedback popup)
    let left = this.mouseX + offset;
    let top = this.mouseY - popupHeight - offset;

    // If would go above viewport, place below cursor
    if (top < 10) {
      top = this.mouseY + offset;
    }

    // Adjust if would go off the right edge
    const maxLeft = viewportWidth - popupWidth - 10;
    if (left > maxLeft) left = maxLeft;
    if (left < 10) left = 10;

    // Adjust if would go off the bottom edge
    const maxTop = viewportHeight - popupHeight - 10;
    if (top > maxTop) top = maxTop;
    if (top < 10) top = 10;

    this.popover.style.left = `${Math.round(left)}px`;
    this.popover.style.top = `${Math.round(top)}px`;
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => new DidYouKnowController());
} else {
  new DidYouKnowController();
}
