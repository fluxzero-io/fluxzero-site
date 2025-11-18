/**
 * Javadoc Tooltip Library
 *
 * Provides interactive tooltips for elements with data-jdoc attribute.
 * Fetches and displays Javadoc documentation inline on hover.
 */

const JAVADOC_JSON_BASE = 'https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/json-doclet';
const TOOLTIP_ID = 'javadoc-tooltip';
const CLOSE_DELAY = 300; // ms before closing when mouse leaves

class JavadocTooltip {
  private tooltip: HTMLElement | null = null;
  private currentTrigger: HTMLElement | null = null;
  private docCache = new Map<string, string>();
  private closeTimeout: number | null = null;
  private isHoveringTooltip = false;
  private isHoveringTrigger = false;

  constructor() {
    this.createTooltip();
    this.attachEventListeners();
    this.attachClickOutsideHandler();
  }

  private createTooltip(): void {
    // Create tooltip element
    this.tooltip = document.createElement('div');
    this.tooltip.id = TOOLTIP_ID;
    this.tooltip.className = 'javadoc-tooltip';
    this.tooltip.setAttribute('role', 'tooltip');
    this.tooltip.innerHTML = `
      <div class="javadoc-tooltip-header">
        <span class="javadoc-tooltip-title"></span>
        <button class="javadoc-tooltip-close" aria-label="Close" title="Close">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 4L4 12M4 4L12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
          </svg>
        </button>
      </div>
      <div class="javadoc-tooltip-content">
        <div class="javadoc-tooltip-loading">Loading...</div>
      </div>
    `;
    document.body.appendChild(this.tooltip);

    // Close button handler
    const closeButton = this.tooltip.querySelector('.javadoc-tooltip-close');
    closeButton?.addEventListener('click', () => {
      this.hideTooltip();
    });

    // Tooltip hover handlers
    this.tooltip.addEventListener('mouseenter', () => {
      this.isHoveringTooltip = true;
      this.clearCloseTimeout();
    });

    this.tooltip.addEventListener('mouseleave', () => {
      this.isHoveringTooltip = false;
      this.scheduleClose();
    });
  }

  private attachEventListeners(): void {
    // Event delegation for all [data-jdoc] elements
    document.addEventListener('mouseover', (e) => {
      const target = (e.target as HTMLElement).closest('[data-jdoc]') as HTMLElement;
      if (target && target.hasAttribute('data-jdoc')) {
        this.handleMouseEnter(target);
      }
    });

    // Handle mouse leave from trigger elements
    document.addEventListener('mouseout', (e) => {
      const target = (e.target as HTMLElement).closest('[data-jdoc]') as HTMLElement;
      if (target && target === this.currentTrigger) {
        const relatedTarget = e.relatedTarget as HTMLElement;
        // Check if we're moving to the tooltip
        if (!this.tooltip?.contains(relatedTarget)) {
          this.isHoveringTrigger = false;
          this.scheduleClose();
        }
      }
    });
  }

  private attachClickOutsideHandler(): void {
    document.addEventListener('click', (e) => {
      if (!this.tooltip?.classList.contains('visible')) {
        return;
      }

      const target = e.target as HTMLElement;

      // Check if click is outside both tooltip and trigger element
      const isClickInsideTooltip = this.tooltip.contains(target);
      const isClickInsideTrigger = this.currentTrigger?.contains(target);

      if (!isClickInsideTooltip && !isClickInsideTrigger) {
        this.hideTooltip();
      }
    });
  }

  private handleMouseEnter(element: HTMLElement): void {
    this.isHoveringTrigger = true;
    this.clearCloseTimeout();

    const qualifiedName = element.getAttribute('data-jdoc');
    if (!qualifiedName) return;

    // If same element, just keep showing
    if (this.currentTrigger === element && this.tooltip?.classList.contains('visible')) {
      return;
    }

    this.currentTrigger = element;
    this.showTooltip(element, qualifiedName);
  }

  private async showTooltip(element: HTMLElement, qualifiedName: string): Promise<void> {
    if (!this.tooltip) return;

    // Update header with class name
    const title = this.tooltip.querySelector('.javadoc-tooltip-title');
    if (title) {
      const simpleName = qualifiedName.split('.').pop() || qualifiedName;
      title.textContent = simpleName;
    }

    // Position tooltip near element
    this.positionTooltip(element);

    // Show tooltip with loading state
    const content = this.tooltip.querySelector('.javadoc-tooltip-content');
    if (!content) return;

    this.tooltip.classList.add('visible');

    // Check cache first
    if (this.docCache.has(qualifiedName)) {
      content.innerHTML = this.docCache.get(qualifiedName)!;
      return;
    }

    // Show loading state
    content.innerHTML = '<div class="javadoc-tooltip-loading">Loading...</div>';

    // Fetch documentation
    try {
      const jsonPath = qualifiedName.replace(/\./g, '/');
      const jsonUrl = `${JAVADOC_JSON_BASE}/${jsonPath}.json`;

      const response = await fetch(jsonUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const documentation = data.documentation || '<p>No documentation available.</p>';

      // Process and clean up the documentation
      const processedDoc = this.processJavadocContent(documentation);

      // Cache and display
      this.docCache.set(qualifiedName, processedDoc);
      content.innerHTML = processedDoc;

      // Reposition in case content changed size
      this.positionTooltip(element);
    } catch (error) {
      console.error('Failed to fetch javadoc:', error);
      content.innerHTML = '<div class="javadoc-tooltip-error">Failed to load documentation</div>';
    }
  }

  private positionTooltip(element: HTMLElement): void {
    if (!this.tooltip) return;

    const triggerRect = element.getBoundingClientRect();
    const tooltipRect = this.tooltip.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const MARGIN = 8; // Spacing between trigger and tooltip
    const EDGE_PADDING = 16; // Padding from viewport edges

    // Calculate initial position (centered above trigger)
    let top = triggerRect.top - tooltipRect.height - MARGIN;
    let left = triggerRect.left + (triggerRect.width / 2) - (tooltipRect.width / 2);

    // Check if tooltip fits above
    if (top < EDGE_PADDING) {
      // Flip to below
      top = triggerRect.bottom + MARGIN;
    }

    // Check if tooltip fits below (if we flipped)
    if (top + tooltipRect.height > viewportHeight - EDGE_PADDING) {
      // Try to keep it above but adjust vertically
      top = Math.max(EDGE_PADDING, viewportHeight - tooltipRect.height - EDGE_PADDING);
    }

    // Horizontal adjustments
    if (left < EDGE_PADDING) {
      left = EDGE_PADDING;
    } else if (left + tooltipRect.width > viewportWidth - EDGE_PADDING) {
      left = viewportWidth - tooltipRect.width - EDGE_PADDING;
    }

    // Apply position
    this.tooltip.style.top = `${top}px`;
    this.tooltip.style.left = `${left}px`;
  }

  private scheduleClose(): void {
    this.clearCloseTimeout();
    this.closeTimeout = window.setTimeout(() => {
      if (!this.isHoveringTooltip && !this.isHoveringTrigger) {
        this.hideTooltip();
      }
    }, CLOSE_DELAY);
  }

  private clearCloseTimeout(): void {
    if (this.closeTimeout !== null) {
      clearTimeout(this.closeTimeout);
      this.closeTimeout = null;
    }
  }

  private hideTooltip(): void {
    if (!this.tooltip) return;
    this.tooltip.classList.remove('visible');
    this.currentTrigger = null;
  }

  private processJavadocContent(html: string): string {
    // Replace Javadoc inline tags with formatted HTML
    let processed = html;

    // {@link ClassName} or {@link ClassName#method} -> bold text
    processed = processed.replace(/\{@link\s+([^}]+)\}/g, (_, content) => {
      // Extract just the class/method name (remove package path and #)
      const simpleName = content.split('.').pop()?.replace('#', '.') || content;
      return `<strong>${simpleName}</strong>`;
    });

    // {@code text} -> inline code
    processed = processed.replace(/\{@code\s+([^}]+)\}/g, (_, content) => {
      return `<code>${content}</code>`;
    });

    // {@literal text} -> escaped text (treat as plain text)
    processed = processed.replace(/\{@literal\s+([^}]+)\}/g, (_, content) => {
      return content;
    });

    // {@value field} -> bold text
    processed = processed.replace(/\{@value\s+([^}]+)\}/g, (_, content) => {
      return `<strong>${content}</strong>`;
    });

    // {@linkplain ClassName} -> plain text link (no code formatting)
    processed = processed.replace(/\{@linkplain\s+([^}]+)\}/g, (_, content) => {
      const simpleName = content.split('.').pop()?.replace('#', '.') || content;
      return `<strong>${simpleName}</strong>`;
    });

    // {@inheritDoc} -> remove (not useful in tooltip context)
    processed = processed.replace(/\{@inheritDoc\}/g, '');

    // {@docRoot} -> remove (not useful in tooltip context)
    processed = processed.replace(/\{@docRoot\}/g, '');

    return processed;
  }
}

// Singleton instance
let tooltipInstance: JavadocTooltip | null = null;

// Initialize on page load
function initJavadocTooltips(): void {
  // Only create one instance
  if (!tooltipInstance) {
    tooltipInstance = new JavadocTooltip();
  }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initJavadocTooltips);
} else {
  initJavadocTooltips();
}

// Re-initialize after Astro view transitions (but don't create duplicate)
document.addEventListener('astro:page-load', initJavadocTooltips);
