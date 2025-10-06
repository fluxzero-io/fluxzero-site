// Utilities for element-based anchoring using per-element content hashes.
// Normalization keeps length stable (no whitespace collapsing) to make offsets easy.

import { getState } from './feedbackStore.ts';

const HASH_ATTR = 'data-fz-hash';

function norm(s: string): string {
  return String(s)
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E\u201F]/g, '"')
    .replace(/\u00A0/g, ' ');
}

function hash32(s: string): string {
  let h = 5381 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = (((h << 5) + h) ^ s.charCodeAt(i)) >>> 0;
  }
  return h.toString(16);
}

function* textNodes(el: Node): Generator<Text> {
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null as any);
  let n: any;
  while ((n = tw.nextNode())) yield n as Text;
}

function elementNormalizedLength(el: HTMLElement): number {
  let len = 0;
  for (const tn of textNodes(el)) {
    len += norm(tn.nodeValue || '').length;
  }
  return len;
}

function offsetInElementNormalized(el: HTMLElement, node: Node, offset: number): number {
  let pos = 0;
  for (const tn of textNodes(el)) {
    if (tn === node) {
      pos += norm((tn.nodeValue || '').slice(0, offset)).length;
      break;
    } else {
      pos += norm(tn.nodeValue || '').length;
    }
  }
  return pos;
}

function rangeWithinElementFromOffsets(el: HTMLElement, start: number, end: number): Range | null {
  let acc = 0;
  const range = document.createRange();
  let haveStart = false, haveEnd = false;
  for (const tn of textNodes(el)) {
    const t = norm(tn.nodeValue || '');
    const l = t.length;
    if (!haveStart && acc + l >= start) {
      const within = start - acc;
      // map back to original index (same length normalization)
      range.setStart(tn, within);
      haveStart = true;
    }
    if (!haveEnd && acc + l >= end) {
      const within = end - acc;
      range.setEnd(tn, within);
      haveEnd = true;
      break;
    }
    acc += l;
  }
  return haveStart && haveEnd ? range : null;
}

function nearestHashElement(node: Node): HTMLElement | null {
  let el: HTMLElement | null = node instanceof Element ? node : node.parentElement;
  while (el && !el.hasAttribute(HASH_ATTR)) {
    el = el.parentElement;
  }
  return el;
}

function allowedBlocks(root: HTMLElement): HTMLElement[] {
  const sel = 'p,li,blockquote,pre,code,td,th,div,h1,h2,h3,h4,h5,h6';
  return Array.from(root.querySelectorAll(sel)) as HTMLElement[];
}

export function ensureHashesForContainer(root: HTMLElement) {
  allowedBlocks(root).forEach((el) => {
    if (!el.hasAttribute(HASH_ATTR)) {
      const h = hash32(norm(el.textContent || ''));
      el.setAttribute(HASH_ATTR, h);
    }
  });
}

export function buildSegmentsFromRange(root: HTMLElement, range: Range) {
  ensureHashesForContainer(root);
  const startEl = nearestHashElement(range.startContainer);
  const endEl = nearestHashElement(range.endContainer);
  if (!startEl || !endEl) return [] as any[];

  const blocks = allowedBlocks(root);
  const idxStart = blocks.indexOf(startEl);
  const idxEnd = blocks.indexOf(endEl);
  if (idxStart === -1 || idxEnd === -1) return [] as any[];

  const segments: Array<{ hash: string; start: number; end: number }> = [];
  if (idxStart === idxEnd) {
    const hash = startEl.getAttribute(HASH_ATTR)!;
    const start = offsetInElementNormalized(startEl, range.startContainer, range.startOffset);
    const end = offsetInElementNormalized(endEl, range.endContainer, range.endOffset);
    segments.push({ hash, start, end });
  } else {
    // start segment
    const startHash = startEl.getAttribute(HASH_ATTR)!;
    const startOff = offsetInElementNormalized(startEl, range.startContainer, range.startOffset);
    segments.push({ hash: startHash, start: startOff, end: elementNormalizedLength(startEl) });
    // middle full segments
    for (let i = idxStart + 1; i < idxEnd; i++) {
      const el = blocks[i];
      const hash = el.getAttribute(HASH_ATTR)!;
      segments.push({ hash, start: 0, end: elementNormalizedLength(el) });
    }
    // end segment
    const endHash = endEl.getAttribute(HASH_ATTR)!;
    const endOff = offsetInElementNormalized(endEl, range.endContainer, range.endOffset);
    segments.push({ hash: endHash, start: 0, end: endOff });
  }
  return segments;
}

export function rangeFromSegments(root: HTMLElement, segments: Array<{ hash: string; start: number; end: number }>): Range | null {
  if (!segments || segments.length === 0) return null;
  ensureHashesForContainer(root);
  const blocks = allowedBlocks(root);
  const findByHash = (h: string) => blocks.find((el) => el.getAttribute(HASH_ATTR) === h) || null;

  const first = segments[0];
  const last = segments[segments.length - 1];
  const startEl = findByHash(first.hash);
  const endEl = findByHash(last.hash);
  if (!startEl || !endEl) return null;
  const r1 = rangeWithinElementFromOffsets(startEl, first.start, first.end);
  if (!r1) return null;
  const r2 = segments.length === 1 ? r1 : rangeWithinElementFromOffsets(endEl, last.start, last.end);
  if (!r2) return null;
  const range = document.createRange();
  range.setStart(r1.startContainer, r1.startOffset);
  range.setEnd(r2.endContainer, r2.endOffset);
  return range;
}

export function findContainerForNode(node: Node): HTMLElement {
  // Heuristic: prefer main content containers
  const candidates = ['.sl-markdown-content', 'article', 'main', '#content'];
  let el: HTMLElement | null = node instanceof Element ? node : node.parentElement;
  while (el) {
    if (candidates.some((sel) => el!.matches?.(sel))) return el;
    el = el.parentElement;
  }
  return document.body as HTMLElement;
}
