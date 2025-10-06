import { subscribe, type FeedbackState } from './feedbackStore.ts';

export function initFeedbackHighlighter(options: { slug: string; root?: HTMLElement }) {
  const controller = new FeedbackHighlighterController(options.slug, options.root);
  return controller;
}

class FeedbackHighlighterController {
  private slug: string;
  private root: HTMLElement;
  private groups: Array<{ key?: string; element: HTMLElement; anchor: HTMLElement; rect: DOMRect; discussions: any[]; spans: HTMLElement[] }> = [];
  private processed = new Set<string>();
  private unsubscribe: null | (() => void) = null;

  constructor(slug: string, root?: HTMLElement) {
    this.slug = slug;
    this.root = (root && root instanceof HTMLElement) ? root : document.body;
    this.init();
  }

  private log(...args: any[]) {
    try {
      console.debug('[FloatingFeedback]', ...args);
    } catch {}
  }

  private async init() {
    // reactive subscribe to store
    this.unsubscribe = subscribe((s) => this.onState(s));
    this.setupScrollResize();
  }

  private onState(state: FeedbackState) {
    // Reset and rebuild on any non-loading update to keep indicators in sync
    if (state.slug !== this.slug) {
      this.slug = state.slug || this.slug;
    }
    if (!state.slug || state.slug !== this.slug) {
      this.log('highlighter:skip', { expected: this.slug, received: state.slug });
      return;
    }
    this.log('highlighter:onState', { slug: this.slug, discussions: state.discussions?.length });
    this.clearAll();
    this.ensureHashes();
    const open = (state.discussions || []).filter((d) => !d.closed);
    open.forEach((d, index) => {
      const sel = (d as any).metadata?.selection || {};
      const segments = Array.isArray(sel.segments) ? sel.segments : [];
      if (!segments.length) {
        this.log('onState: discussion missing segments, skipping direct anchor', { id: d.id, selection: sel });
        return;
      }
      const loc = this.anchorBySegments(segments);
      if (loc) {
        this.placeHighlightAndIndicator(d as any, loc, index);
      } else {
        this.log('onState: segment anchoring failed, attempting text search', { id: d.id, selection: sel });
        const fallback = this.findTextInPage(sel.text || null, sel.context || null);
        if (fallback) {
          this.log('onState: fallback text search succeeded', { id: d.id, location: fallback });
          this.placeHighlightAndIndicator(d as any, fallback, index);
        } else {
          this.log('onState: unable to locate discussion in page', { id: d.id, selection: sel });
        }
      }
    });
    try { window.dispatchEvent(new CustomEvent('feedback:highlights-updated')); } catch {}
  }

  private ensureHashes() {
    const sel = 'p,li,blockquote,pre,code,td,th,div,h1,h2,h3,h4,h5,h6';
    const blocks = this.root.querySelectorAll(sel);
    blocks.forEach((el) => {
      const he = el as HTMLElement;
      if (!he.hasAttribute('data-fz-hash')) {
        const txt = this.normQuotes(he.textContent || '');
        // simple 32-bit hash
        let h = 5381 >>> 0;
        for (let i = 0; i < txt.length; i++) { h = (((h << 5) + h) ^ txt.charCodeAt(i)) >>> 0; }
        he.setAttribute('data-fz-hash', h.toString(16));
      }
    });
  }

  private anchorBySegments(segments: Array<{ hash: string; start: number; end: number }>) {
    if (!segments || segments.length === 0) {
      this.log('anchorBySegments: no segments provided');
      return null;
    }
    this.log('anchorBySegments: attempting lookup', segments);
    const blocks = Array.from(this.root.querySelectorAll('[data-fz-hash]')) as HTMLElement[];
    const findByHash = (h: string) => blocks.find((el) => el.getAttribute('data-fz-hash') === h) || null;
    const toRange = (el: HTMLElement, start: number, end: number): Range | null => {
      const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null as any);
      let acc = 0;
      const r = document.createRange();
      let sSet = false, eSet = false, n: any;
      while ((n = tw.nextNode())) {
        const t = (n.nodeValue || '').replace(/[\u2018\u2019\u201A\u201B]/g, "'").replace(/[\u201C\u201D\u201E\u201F]/g, '"').replace(/\u00A0/g, ' ');
        const l = t.length;
        if (!sSet && acc + l >= start) { r.setStart(n, start - acc); sSet = true; }
        if (!eSet && acc + l >= end) { r.setEnd(n, end - acc); eSet = true; break; }
        acc += l;
      }
      if (sSet && eSet) return r;
      this.log('anchorBySegments: failed to build range in element', { el, start, end, sSet, eSet });
      return null;
    };
    const parts: any[] = [];
    for (const seg of segments) {
      const el = findByHash(seg.hash);
      if (!el) {
        this.log('anchorBySegments: no element for hash', seg.hash);
        return null;
      }
      const r = toRange(el, seg.start, seg.end);
      if (!r) {
        this.log('anchorBySegments: no range for segment', seg);
        return null;
      }
      parts.push({ range: r, rect: r.getBoundingClientRect(), element: el });
    }
    const first = parts[0];
    const last = parts[parts.length - 1];
    const key = `${Math.round(first.rect.top)}|${Math.round(first.rect.left)}|${Math.round(first.rect.width)}|${Math.round(first.rect.height)}|${segments[0].hash}`;
    const location = { parts, rect: first.rect, element: first.element, key };
    this.log('anchorBySegments: resolved location', location);
    return location;
  }

  private findTextInPage(selectedText: string | null, context?: { prefix?: string; suffix?: string } | null) {
    if (!selectedText) {
      this.log('findTextInPage: no text provided');
      return null as const;
    }
    this.log('findTextInPage: searching for text', { selectedText, context });
    const needle = this.normQuotes(selectedText);
    const walker = document.createTreeWalker(
      this.root,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = (node as any).parentElement as HTMLElement | null;
          if (!parent) return NodeFilter.FILTER_REJECT;
          const tag = parent.tagName;
          if (tag === 'SCRIPT' || tag === 'STYLE') return NodeFilter.FILTER_REJECT;
          if (parent.closest('.floating-feedback-container') || parent.closest('.feedback-popup') || parent.closest('.feedback-compose')) return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        },
      } as any
    );

    let node: any;
    while ((node = walker.nextNode())) {
      const raw: string = node.textContent || '';
      const hay = this.normQuotes(raw);
      let start = hay.indexOf(needle);
      let matchLen = needle.length;
      // Fallback: fuzzy whitespace-insensitive match
      if (start === -1) {
        try {
          const pattern = needle.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
          const re = new RegExp(pattern);
          const m = hay.match(re);
          if (m && m.index != null) { start = m.index; matchLen = m[0].length; }
        } catch {}
      }
      if (start !== -1) {
        // If we have context, validate it against surrounding text
        if (context && (context.prefix || context.suffix)) {
          const prev = hay.slice(Math.max(0, start - 50), start);
          const next = hay.slice(start + matchLen, start + matchLen + 50);
          const p = context.prefix ? this.normQuotes(String(context.prefix)) : '';
          const s = context.suffix ? this.normQuotes(String(context.suffix)) : '';
          if (p && !prev.endsWith(p)) { continue; }
          if (s && !next.startsWith(s)) { continue; }
        }
        const range = document.createRange();
        range.setStart(node, Math.max(0, start));
        range.setEnd(node, Math.min((node as any).length || raw.length, start + Math.max(1, matchLen)));
        const rect = range.getBoundingClientRect();
        const key = `${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}|${Math.round(rect.height)}|${needle}`;
        const result = { range, rect, element: node.parentElement as HTMLElement, text: selectedText, key };
        this.log('findTextInPage: direct text node match', result);
        return result;
      }
    }
    // Fallback: search within common block elements and build a multi-node range
    const block = this.findInBlocks(selectedText, context);
    if (block) {
      this.log('findTextInPage: fallback block match', block);
      return block as any;
    }
    this.log('findTextInPage: failed to locate text', { selectedText, context });
    return null as const;
  }

  private makeKey(hay: string, start: number, len: number) {
    const before = hay.slice(Math.max(0, start - 20), start);
    const mid = hay.slice(start, start + len);
    const after = hay.slice(start + len, start + len + 20);
    return `${before}|${mid}|${after}`;
  }

  private isUiNode(el: Element | null) {
    if (!el) return false;
    return !!(el.closest('.floating-feedback-container') || el.closest('.feedback-popup') || el.closest('.feedback-compose'));
  }

  private findInBlocks(selectedText: string, context?: { prefix?: string; suffix?: string } | null) {
    const needle = this.normQuotes(selectedText);
    const blocks = this.root.querySelectorAll('p, li, blockquote, pre, code, h1, h2, h3, h4, h5, h6');
    for (const el of Array.from(blocks)) {
      if (this.isUiNode(el)) continue;
      const raw = (el as HTMLElement).textContent || '';
      const hay = this.normQuotes(raw);
      let start = hay.indexOf(needle);
      let matchLen = needle.length;
      if (start === -1) {
        try {
          const pattern = needle.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&').replace(/\s+/g, '\\s+');
          const re = new RegExp(pattern);
          const m = hay.match(re);
          if (m && m.index != null) { start = m.index; matchLen = m[0].length; }
        } catch {}
      }
      if (start === -1) continue;
      if (context && (context.prefix || context.suffix)) {
        const prev = hay.slice(Math.max(0, start - 50), start);
        const next = hay.slice(start + matchLen, start + matchLen + 50);
        const p = context.prefix ? this.normQuotes(String(context.prefix)) : '';
        const s = context.suffix ? this.normQuotes(String(context.suffix)) : '';
        if (p && !prev.endsWith(p)) continue;
        if (s && !next.startsWith(s)) continue;
      }
      const range = this.buildRangeWithinElement(el as HTMLElement, start, matchLen);
      if (range) {
        const rect = range.getBoundingClientRect();
        const key = `${Math.round(rect.top)}|${Math.round(rect.left)}|${Math.round(rect.width)}|${Math.round(rect.height)}|${needle}`;
        const result = { range, rect, element: el as HTMLElement, text: selectedText, key };
        this.log('findInBlocks: matched within block', { element: el, result });
        return result;
      }
    }
    this.log('findInBlocks: no match found', { selectedText, context });
    return null;
  }

  private buildRangeWithinElement(el: HTMLElement, start: number, len: number): Range | null {
    const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null as any);
    let idx = 0;
    let startNode: Node | null = null; let startOffset = 0;
    let endNode: Node | null = null; let endOffset = 0;
    let node: any;
    while ((node = tw.nextNode())) {
      const text = this.normQuotes(node.textContent || '');
      const l = text.length;
      if (!startNode && idx + l >= start) {
        startNode = node;
        startOffset = Math.max(0, start - idx);
      }
      if (startNode && idx + l >= start + len) {
        endNode = node;
        endOffset = Math.max(0, start + len - idx);
        break;
      }
      idx += l;
    }
    if (startNode && endNode) {
      const range = document.createRange();
      range.setStart(startNode, startOffset);
      range.setEnd(endNode, endOffset);
      return range;
    }
    return null;
  }

  private normQuotes(s: string) {
    return String(s)
      .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
      .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
      .replace(/\u00A0/g, ' ');
  }

  private updateSpanIds(span: HTMLElement, ids: string[]) {
    const unique = Array.from(new Set(ids.filter(Boolean)));
    span.dataset.feedbackHighlight = 'true';
    span.dataset.feedbackIds = JSON.stringify(unique);
  }

  private closestHighlightSpan(node: Node | null): HTMLElement | null {
    if (!node) return null;
    let el: HTMLElement | null = null;
    if (node instanceof HTMLElement) {
      el = node;
    } else if (node.nodeType === Node.TEXT_NODE) {
      el = node.parentElement;
    }
    return el ? el.closest('span.feedback-highlight[data-feedback-highlight="true"]') as HTMLElement | null : null;
  }

  private mergeRangesIntoGroup(group: { element: HTMLElement; spans: HTMLElement[]; anchor: HTMLElement }, textLocation: any, ids: string[]) {
    const merged = new Set<HTMLElement>((group.spans || []).filter(Boolean));
    const parts = Array.isArray(textLocation.parts) ? textLocation.parts : [];
    parts.forEach((p: any) => {
      const r: Range = p.range;
      if (!r) return;
      const startSpan = this.closestHighlightSpan(r.startContainer);
      const endSpan = this.closestHighlightSpan(r.endContainer);
      if (startSpan && startSpan === endSpan) {
        merged.add(startSpan);
        return;
      }
      const span = document.createElement('span');
      span.className = 'feedback-highlight';
      this.updateSpanIds(span, ids);
      try {
        const frag = r.extractContents();
        span.appendChild(frag);
        r.insertNode(span);
      } catch {}
      merged.add(span);
      this.attachSpanHoverHandlers(span, group.element);
    });
    const result = Array.from(merged);
    result.forEach((span) => this.updateSpanIds(span, ids));
    group.spans = result;
    if (!group.anchor || !result.includes(group.anchor)) {
      group.anchor = result[0] || group.anchor;
    }
    return result;
  }

  private placeHighlightAndIndicator(discussion: any, textLocation: any, index: number) {
    const rect: DOMRect = textLocation.rect;
    // Try to find existing group first (same key/line); reuse its anchor to avoid double wrapping
    let group = this.findGroup(rect, textLocation.key);
    let anchor: HTMLElement;
    if (!group) {
      // Create highlight spans per part (e.g., per LI) to avoid wrapping block elements
      const parts = Array.isArray(textLocation.parts) ? textLocation.parts : [];
      let firstSpan: HTMLElement | null = null;
      const createdSpans: HTMLElement[] = [];
      parts.forEach((p: any) => {
        const r: Range = p.range;
        const span = document.createElement('span');
        span.className = 'feedback-highlight';
        this.updateSpanIds(span, [discussion.id]);
        const frag = r.extractContents();
        span.appendChild(frag);
        r.insertNode(span);
        if (!firstSpan) firstSpan = span;
        createdSpans.push(span);
      });
      anchor = firstSpan || (parts[0]?.element as HTMLElement) || (textLocation.element as HTMLElement);
      if (!anchor) return;
      const highlightSpans = createdSpans.length ? createdSpans : (firstSpan ? [firstSpan] : []);
      group = this.createGroup(rect, anchor, discussion, textLocation.key, highlightSpans);
      this.groups.push(group);
      document.body.appendChild(group.element);
      // Attach hover handlers to all created spans so indicator appears near any part
      highlightSpans.forEach((sp) => this.attachSpanHoverHandlers(sp, group.element));
      // Bind robust click handler that closes over this group
      group.element.addEventListener('click', (e) => {
        e.preventDefault();
        if (group.discussions.length > 1) {
          window.dispatchEvent(new CustomEvent('feedback:open-group', { detail: { discussions: group.discussions } }));
        } else {
          const first = group.discussions[0] || discussion;
          window.dispatchEvent(new CustomEvent('feedback:open-id', { detail: { id: first.id, discussion: first } }));
        }
      });
    } else {
      anchor = group.anchor;
      const existingIds = group.discussions.map((d: any) => d.id);
      const allIds = Array.from(new Set([...existingIds, discussion.id]));
      this.mergeRangesIntoGroup(group, textLocation, allIds);
      anchor = group.anchor;
      group.discussions.push(discussion);
      const badge = group.element.querySelector('.feedback-badge');
      if (badge) badge.textContent = `💬 ${group.discussions.length}`;
      this.updateAbsolutePosition(group.element, group.anchor);
    }
    // Map id to anchor for external lookup
    try { (this as any).anchorById ||= new Map(); } catch {}
    (this as any).anchorById.set(discussion.id, anchor);
  }

  private findGroup(rect: DOMRect, key?: string) {
    const topThreshold = 4;
    const overlap = (a: DOMRect, b: DOMRect) => (a.left <= b.right && a.right >= b.left);
    let found = key ? this.groups.find(g => g.key === key) : undefined;
    if (!found) found = this.groups.find(g => Math.abs(g.rect.top - rect.top) <= topThreshold && overlap(g.rect, rect));
    return found;
  }

  private createGroup(rect: DOMRect, anchor: HTMLElement, discussion: any, key?: string, spans: HTMLElement[] = [anchor]) {
    const indicator = document.createElement('div');
    indicator.className = 'feedback-indicator';
    (indicator as any).dataset.discussionId = discussion.id;
    indicator.innerHTML = `<div class="feedback-badge">💬 1</div>`;
    this.updateAbsolutePosition(indicator, anchor);

    indicator.style.opacity = '0';
    indicator.style.pointerEvents = 'auto';
    const hide = () => {
      indicator.style.opacity = '0';
      indicator.style.transform = 'scale(0.8)';
    };
    const show = (ref?: HTMLElement) => {
      if (ref) this.updateAbsolutePosition(indicator, ref);
      const ht = (indicator as any)._ht;
      if (ht) { try { clearTimeout(ht); } catch {} }
      indicator.style.opacity = '0.8';
      indicator.style.transform = 'scale(1)';
    };
    const scheduleHide = (delay = 200) => {
      const ht = setTimeout(hide, delay);
      (indicator as any)._ht = ht;
    };
    anchor.addEventListener('mouseenter', () => show(anchor));
    anchor.addEventListener('mouseleave', () => scheduleHide(300));
    indicator.addEventListener('mouseenter', () => {
      const ht = (indicator as any)._ht;
      if (ht) { try { clearTimeout(ht); } catch {} }
      indicator.style.opacity = '1';
      indicator.style.transform = 'scale(1.1)';
    });
    indicator.addEventListener('mouseleave', () => scheduleHide(120));
    // Ensure clicks are not lost due to pending hides
    indicator.addEventListener('mousedown', () => {
      const ht = (indicator as any)._ht;
      if (ht) { try { clearTimeout(ht); } catch {} }
      indicator.style.opacity = '1';
      indicator.style.pointerEvents = 'auto';
      indicator.style.transform = 'scale(1)';
    });

    indicator.addEventListener('click', (e) => {
      e.preventDefault();
      const g = this.groups.find(x => x.element === indicator);
      if (g && g.discussions.length > 1) {
        window.dispatchEvent(new CustomEvent('feedback:open-group', { detail: { discussions: g.discussions, clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY } }));
      } else {
        const first = (g?.discussions?.[0]) || discussion;
        window.dispatchEvent(new CustomEvent('feedback:open-id', { detail: { id: first.id, discussion: first, clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY } }));
      }
    });

    return { key, element: indicator, anchor, rect, discussions: [discussion], spans: spans.length ? spans : [anchor] };
  }

  private attachSpanHoverHandlers(span: HTMLElement, indicator: HTMLElement) {
    span.addEventListener('mouseenter', (e: MouseEvent) => {
      const ht = (indicator as any)._ht;
      if (ht) { try { clearTimeout(ht); } catch {} }
      const sl = window.pageXOffset || document.documentElement.scrollLeft;
      const st = window.pageYOffset || document.documentElement.scrollTop;
      indicator.style.left = `${e.clientX + 20 + sl}px`;
      indicator.style.top = `${e.clientY - 30 + st}px`;
      indicator.style.opacity = '0.9';
      indicator.style.transform = 'scale(1)';
    });
    span.addEventListener('mouseleave', () => {
      const ht = setTimeout(() => {
        indicator.style.opacity = '0';
        indicator.style.transform = 'scale(0.8)';
      }, 220);
      (indicator as any)._ht = ht;
    });
  }

  private findOrCreateGroup(rect: DOMRect, anchor: HTMLElement, discussion: any, key?: string) {
    const topThreshold = 4; // px tolerance for same line
    const overlap = (a: DOMRect, b: DOMRect) => (a.left <= b.right && a.right >= b.left);
    let found = key ? this.groups.find(g => g.key === key) : undefined;
    if (!found) {
      found = this.groups.find(g => Math.abs(g.rect.top - rect.top) <= topThreshold && overlap(g.rect, rect));
    }
    if (found) {
      found.discussions.push(discussion);
      return found;
    }
    // Create new group
    const indicator = document.createElement('div');
    indicator.className = 'feedback-indicator';
    (indicator as any).dataset.discussionId = discussion.id;
    indicator.innerHTML = `<div class="feedback-badge">💬 1</div>`;
    this.updateAbsolutePosition(indicator, anchor);

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
    anchor.addEventListener('mouseenter', show);
    anchor.addEventListener('mouseleave', () => scheduleHide(300));
    indicator.addEventListener('mouseenter', () => { clearTimeout(hideTimeout); indicator.style.opacity = '1'; indicator.style.transform = 'scale(1.1)'; });
    indicator.addEventListener('mouseleave', () => scheduleHide(100));

    document.body.appendChild(indicator);
    const group = { key, element: indicator, anchor, rect, discussions: [discussion] };
    indicator.addEventListener('click', (e) => {
      e.preventDefault();
      const first = group.discussions[0] || discussion;
      window.dispatchEvent(new CustomEvent('feedback:open-id', { detail: { id: first.id, discussion: first, clientX: (e as MouseEvent).clientX, clientY: (e as MouseEvent).clientY } }));
    });
    this.groups.push(group);
    return group;
  }

  private clearAll() {
    this.processed.clear();
    this.groups.forEach(({ element }) => element.remove());
    this.groups = [];
    // Unwrap existing non-temporary highlights to avoid nesting
    try {
      this.root.querySelectorAll('span.feedback-highlight:not(.feedback-highlight--temp)').forEach((el) => {
        const span = el as HTMLElement;
        const frag = document.createDocumentFragment();
        while (span.firstChild) frag.appendChild(span.firstChild);
        span.replaceWith(frag);
      });
    } catch {}
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
      this.groups.forEach(({ element, anchor }) => this.updateAbsolutePosition(element, anchor));
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
