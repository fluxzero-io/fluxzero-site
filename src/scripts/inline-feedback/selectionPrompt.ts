import { buildSegmentsFromRange } from './domAnchors.ts';
import { getState, submitFeedback } from './feedbackStore.ts';

type SelectionContext = {
  prefix?: string;
  suffix?: string;
};

type ShowComposerArgs = {
  quote: string;
  anchor: HTMLElement;
  preset?: string;
  context?: SelectionContext | null;
  segments?: Array<{ hash: string; start: number; end: number }>;
};

export class SelectionPromptController {
  private el: HTMLElement | null = null;
  private tempHighlight: HTMLElement | null = null;
  private lastRange: Range | null = null;
  private lastText = '';
  private rootSelector: string;
  private mountId: string;
  private root: HTMLElement | null = null;

  constructor(rootSelector: string, mountId: string) {
    this.rootSelector = rootSelector;
    this.mountId = mountId;
    this.handleSelectionChange = this.handleSelectionChange.bind(this);
    this.handleScrollOrResize = this.handleScrollOrResize.bind(this);
    this.onPromptClick = this.onPromptClick.bind(this);
    this.init();
  }

  restoreFromSession() {
    try {
      const quote = sessionStorage.getItem('fz_feedback_quote');
      const draft = sessionStorage.getItem('fz_feedback_draft');
      const rectStr = sessionStorage.getItem('fz_feedback_rect');
      if (!quote) return;
      let anchor: HTMLElement | null = null;
      const loc = this.findTextInPage(quote);
      if (loc) {
        const span = document.createElement('span');
        span.className = 'feedback-highlight feedback-highlight--temp';
        const frag = loc.range.extractContents();
        span.appendChild(frag);
        loc.range.insertNode(span);
        anchor = span;
        this.tempHighlight = span;
      } else {
        const fallback = document.createElement('div');
        fallback.style.position = 'fixed';
        const rect = rectStr ? JSON.parse(rectStr) : null;
        const left = rect?.left ?? 16;
        const top = rect?.bottom ?? 100;
        fallback.style.left = `${Math.round(left)}px`;
        fallback.style.top = `${Math.round(top)}px`;
        fallback.style.width = '1px';
        fallback.style.height = '1px';
        fallback.style.pointerEvents = 'none';
        document.body.appendChild(fallback);
        anchor = fallback;
      }
      if (anchor && typeof anchor.scrollIntoView === 'function') {
        anchor.scrollIntoView({ behavior: 'instant', block: 'center' });
      }
      setTimeout(() => {
        if (anchor) {
          this.showComposer({ quote, anchor, preset: draft || '' });
        }
      }, 60);
    } catch {}
    try { sessionStorage.removeItem('fz_feedback_quote'); } catch {}
    try { sessionStorage.removeItem('fz_feedback_draft'); } catch {}
    try { sessionStorage.removeItem('fz_feedback_rect'); } catch {}
  }

  private init() {
    this.root = this.resolveRoot(this.rootSelector);
    document.addEventListener('mouseup', this.handleSelectionChange);
    document.addEventListener('keyup', this.handleSelectionChange);
    document.addEventListener('touchend', this.handleSelectionChange, { passive: true });
    window.addEventListener('scroll', this.handleScrollOrResize, { passive: true });
    window.addEventListener('resize', this.handleScrollOrResize, { passive: true });
  }

  private resolveRoot(selector: string) {
    if (selector) {
      const el = document.querySelector(selector);
      if (el && el instanceof HTMLElement) return el;
    }
    if (this.mountId) {
      const mount = document.getElementById(this.mountId);
      if (mount && mount.parentElement instanceof HTMLElement) return mount.parentElement;
    }
    const main = document.querySelector('main');
    return main instanceof HTMLElement ? main : document.body;
  }

  private ensureEl() {
    if (this.el) return this.el;
    const el = document.createElement('div');
    el.className = 'feedback-selection-prompt';
    el.innerHTML = '💬 <span>Add a comment</span>';
    el.style.position = 'fixed';
    el.style.zIndex = '2000';
    el.style.display = 'none';
    document.body.appendChild(el);
    el.addEventListener('click', this.onPromptClick);
    this.el = el;
    return el;
  }

  private handleScrollOrResize() {
    if (this.el && this.el.style.display !== 'none') {
      const sel = window.getSelection();
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        const range = sel.getRangeAt(0);
        this.position(range);
      } else {
        this.hide();
      }
    }
  }

  private handleSelectionChange() {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      this.hide();
      return;
    }

    const range = sel.getRangeAt(0);
    const common = range.commonAncestorContainer instanceof Element
      ? range.commonAncestorContainer
      : range.commonAncestorContainer.parentElement;
    if (
      common &&
      (common.closest('.floating-feedback-container') ||
        common.closest('.feedback-popup') ||
        common.closest('.feedback-indicator') ||
        common.closest('.feedback-compose') ||
        common.closest('.feedback-selection-prompt'))
    ) {
      this.hide();
      return;
    }

    if (!this.root || !document.body.contains(this.root)) {
      this.root = this.resolveRoot(this.rootSelector);
    }

    const root = this.root || document.body;
    const probe = common || range.commonAncestorContainer;
    const probeElement = probe instanceof Element ? probe : probe?.parentElement;
    if (probeElement && !root.contains(probeElement)) {
      this.hide();
      return;
    }

    const text = sel.toString().trim();
    if (!text || text.length < 3) {
      this.hide();
      return;
    }

    this.lastRange = range.cloneRange();
    this.lastText = text;
    this.show(range);
  }

  private onPromptClick(e: MouseEvent) {
    e.preventDefault();
    let range = this.lastRange;
    let text = this.lastText;
    const sel = window.getSelection();
    if ((!range || !text) && sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      range = sel.getRangeAt(0).cloneRange();
      text = sel.toString().trim();
    }
    if (!range || !text || text.length < 3) return;
    const ctx = this.computeContext(range);
    let segments: Array<{ hash: string; start: number; end: number }> = [];
    try {
      const root = this.root || document.body;
      segments = buildSegmentsFromRange(root, range) || [];
    } catch {}
    const span = document.createElement('span');
    span.className = 'feedback-highlight feedback-highlight--temp';
    const frag = range.extractContents();
    span.appendChild(frag);
    range.insertNode(span);
    this.tempHighlight = span;
    if (sel) sel.removeAllRanges();
    this.hide();
    this.showComposer({ quote: text, anchor: span, context: ctx, segments });
  }

  private showComposer({ quote, anchor, preset, context, segments }: ShowComposerArgs) {
    const existing = document.querySelector('.feedback-compose');
    if (existing) existing.remove();
    const popup = document.createElement('div');
    popup.className = 'feedback-compose';
    popup.innerHTML = `
      <div class="compose-header">
        <h4 class="compose-title">Add Feedback</h4>
        <button class="compose-close" aria-label="Close">&times;</button>
      </div>
      <div class="compose-body">
        <div class="compose-quote">${this.escapeHtml(quote)}</div>
        <label for="feedback-compose-text" style="display:none">Feedback</label>
        <textarea id="feedback-compose-text" placeholder="What would you like to tell us?" autofocus></textarea>
      </div>
      <div class="compose-actions">
        <div class="compose-actions-auth" data-auth="unknown">
          <span class="compose-auth-status" style="flex:1; font-size:12px; color:#6b7280"></span>
          <button class="btn" data-action="cancel">Cancel</button>
          <button class="btn btn-primary" data-action="submit">Submit</button>
          <button class="btn btn-primary" data-action="login" style="display:none">Sign in with GitHub</button>
        </div>
      </div>
    `;
    document.body.appendChild(popup);

    const position = () => {
      const rect = anchor.getBoundingClientRect();
      let left = rect.left;
      let top = rect.bottom + 10;
      const width = Math.min(460, window.innerWidth - 32);
      if (left + width > window.innerWidth - 8) {
        left = Math.max(8, window.innerWidth - width - 8);
      }
      if (top + 280 > window.innerHeight) {
        top = Math.max(8, rect.top - 300);
      }
      popup.style.left = `${Math.round(left)}px`;
      popup.style.top = `${Math.round(top)}px`;
    };
    position();
    requestAnimationFrame(() => popup.classList.add('is-visible'));

    let currentSegments = Array.isArray(segments) ? [...segments] : [];
    const ensureSegments = () => {
      if (Array.isArray(currentSegments) && currentSegments.length > 0) {
        return currentSegments;
      }
      try {
        if (anchor instanceof Node) {
          const range = document.createRange();
          if (anchor instanceof Text) {
            range.selectNode(anchor);
          } else {
            range.selectNodeContents(anchor);
          }
          const root = this.root || document.body;
          const rebuilt = buildSegmentsFromRange(root, range) || [];
          if (Array.isArray(rebuilt) && rebuilt.length > 0) {
            currentSegments = rebuilt;
          }
        }
      } catch {}
      return currentSegments || [];
    };

    const authWrap = popup.querySelector('.compose-actions-auth');
    const authNote = popup.querySelector('.compose-auth-status') as HTMLElement | null;
    const btnSubmit = popup.querySelector('[data-action="submit"]') as HTMLElement | null;
    const btnLogin = popup.querySelector('[data-action="login"]') as HTMLElement | null;
    const setAuth = (loggedIn: boolean) => {
      if (!authWrap) return;
      authWrap.setAttribute('data-auth', loggedIn ? 'yes' : 'no');
      if (authNote) authNote.textContent = loggedIn ? '' : 'Sign in to submit feedback.';
      if (btnSubmit) btnSubmit.style.display = loggedIn ? '' : 'none';
      if (btnLogin) btnLogin.style.display = loggedIn ? 'none' : '';
    };
    fetch('/api/auth/github/me').then((r) => setAuth(r.ok)).catch(() => setAuth(false));

    const textarea = popup.querySelector('textarea') as HTMLTextAreaElement | null;
    if (preset && textarea) {
      textarea.value = preset;
    }
    setTimeout(() => textarea?.focus(), 50);

    const close = () => {
      popup.remove();
      if (this.tempHighlight && this.tempHighlight.parentNode) {
        const frag = document.createDocumentFragment();
        while (this.tempHighlight.firstChild) {
          frag.appendChild(this.tempHighlight.firstChild);
        }
        this.tempHighlight.replaceWith(frag);
        this.tempHighlight = null;
      }
    };
    popup.querySelector('.compose-close')?.addEventListener('click', close);
    popup.querySelector('[data-action="cancel"]')?.addEventListener('click', close);

    popup.querySelector('[data-action="login"]')?.addEventListener('click', () => {
      try {
        const ta = popup.querySelector('textarea') as HTMLTextAreaElement | null;
        const draftValue = ta ? ta.value || '' : '';
        sessionStorage.setItem('fz_feedback_draft', draftValue);
        sessionStorage.setItem('fz_feedback_quote', quote);
        const temp = document.querySelector('.feedback-highlight--temp') as HTMLElement | null;
        if (temp && typeof temp.getBoundingClientRect === 'function') {
          const r = temp.getBoundingClientRect();
          const rect = { left: r.left, top: r.top, right: r.right, bottom: r.bottom };
          sessionStorage.setItem('fz_feedback_rect', JSON.stringify(rect));
        }
      } catch {}
      const state = (typeof getState === 'function' ? getState() : null) || { slug: location.pathname };
      const returnTo = encodeURIComponent(state.slug || location.pathname);
      location.href = `/api/auth/github/login?returnTo=${returnTo}`;
    });

    const onSubmit = async () => {
      const ta = popup.querySelector('textarea') as HTMLTextAreaElement | null;
      const message = ta ? String(ta.value || '').trim() : '';
      if (!message) {
        ta?.focus();
        return;
      }
      const state = (typeof getState === 'function' ? getState() : null) || { slug: null };
      const segs = ensureSegments();
      const payload = {
        slug: state.slug || location.pathname,
        selection: {
          text: quote,
          context: context || null,
          segments: segs,
        },
        message,
      };
      try {
        const result = await submitFeedback(payload);
        if (!result.ok && result.status === 401) {
          if (authWrap) setAuth(false);
          return;
        }
        if (this.tempHighlight && this.tempHighlight.parentNode) {
          const frag = document.createDocumentFragment();
          while (this.tempHighlight.firstChild) {
            frag.appendChild(this.tempHighlight.firstChild);
          }
          this.tempHighlight.replaceWith(frag);
          this.tempHighlight = null;
        }
        popup.remove();
      } catch (err) {
        console.error(err);
        const btn = popup.querySelector('[data-action="submit"]') as HTMLElement | null;
        if (btn) btn.textContent = 'Retry';
      }
    };
    popup.querySelector('[data-action="submit"]')?.addEventListener('click', onSubmit);

    const onOutside = (evt: MouseEvent) => {
      if (!popup.contains(evt.target as Node)) {
        document.removeEventListener('mousedown', onOutside);
        close();
      }
    };
    setTimeout(() => document.addEventListener('mousedown', onOutside), 50);

    let ticking = false;
    const onScrollResize = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          position();
          ticking = false;
        });
        ticking = true;
      }
    };
    window.addEventListener('scroll', onScrollResize, { passive: true });
    window.addEventListener('resize', onScrollResize);
  }

  private computeContext(range: Range): SelectionContext {
    const ctx: SelectionContext = { prefix: '', suffix: '' };
    const limit = 80;
    const root = this.root || document.body;
    try {
      const prefixRange = document.createRange();
      prefixRange.setStart(root, 0);
      prefixRange.setEnd(range.startContainer, range.startOffset);
      const prefixText = prefixRange.toString();
      ctx.prefix = prefixText.slice(-limit);
    } catch {}
    try {
      const suffixRange = document.createRange();
      suffixRange.setStart(range.endContainer, range.endOffset);
      suffixRange.setEnd(root, root.childNodes.length);
      const suffixText = suffixRange.toString();
      ctx.suffix = suffixText.slice(0, limit);
    } catch {}
    return ctx;
  }

  private findTextInPage(selectedText: string) {
    if (!selectedText) return null;
    const root = this.root || document.body;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = (node as any).parentElement as HTMLElement | null;
        if (!parent) return NodeFilter.FILTER_REJECT;
        const tag = parent.tagName;
        if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      },
    } as any);
    let node: Text | null;
    while ((node = walker.nextNode() as Text | null)) {
      const text = node?.textContent || '';
      const index = text.indexOf(selectedText);
      if (index !== -1) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + selectedText.length);
        return { range, element: node.parentElement, text: selectedText };
      }
    }
    return null;
  }

  private escapeHtml(s: string) {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private position(range: Range) {
    const rect = range.getBoundingClientRect();
    const el = this.ensureEl();
    const padding = 8;
    const promptWidth = 160;
    const promptHeight = 34;
    let left = rect.right + padding;
    let top = rect.top - promptHeight - 4;
    if (left + promptWidth > window.innerWidth - 8) {
      left = Math.max(8, rect.left - promptWidth - padding);
    }
    if (top < 8) {
      top = Math.min(window.innerHeight - promptHeight - 8, rect.bottom + 6);
    }
    el.style.left = `${Math.round(left)}px`;
    el.style.top = `${Math.round(top)}px`;
  }

  private show(range: Range) {
    const el = this.ensureEl();
    this.position(range);
    el.style.display = 'flex';
    el.style.opacity = '1';
  }

  private hide() {
    if (this.el) {
      this.el.style.display = 'none';
      this.el.style.opacity = '0';
    }
  }
}
