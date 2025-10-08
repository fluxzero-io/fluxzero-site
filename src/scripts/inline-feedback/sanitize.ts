import createDOMPurify from 'dompurify';

type DomPurifyInstance = ReturnType<typeof createDOMPurify>;

declare global {
  interface Window {
    DOMPurifyInstance?: DomPurifyInstance;
  }
}

const DISALLOWED_TAGS = ['script', 'iframe', 'object', 'embed', 'link', 'meta', 'style'];

function getPurifier(): DomPurifyInstance | null {
  if (typeof window !== 'undefined') {
    if (!window.DOMPurifyInstance) {
      window.DOMPurifyInstance = createDOMPurify(window as unknown as Window);
    }
    return window.DOMPurifyInstance;
  }

  if (typeof globalThis !== 'undefined' && (globalThis as any).window) {
    const maybeWindow = (globalThis as any).window;
    return createDOMPurify(maybeWindow);
  }

  return null;
}

const purifier = getPurifier();

export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (purifier) {
    try {
      return purifier.sanitize(html, {
        USE_PROFILES: { html: true },
        FORBID_TAGS: DISALLOWED_TAGS,
        FORBID_ATTR: ['onerror', 'onload', 'style'],
      } as any);
    } catch {}
  }

  if (typeof document === 'undefined') {
    return html.replace(/<[^>]+>/g, '');
  }

  const template = document.createElement('template');
  template.innerHTML = html;

  const elements = template.content.querySelectorAll<HTMLElement>(DISALLOWED_TAGS.join(','));
  elements.forEach((el) => el.remove());

  const allElements = template.content.querySelectorAll<HTMLElement>('*');
  allElements.forEach((el) => {
    [...el.attributes].forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = attr.value;
      if (name.startsWith('on')) {
        el.removeAttribute(attr.name);
        return;
      }
      if (name === 'href' || name === 'src') {
        if (value.trim().toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
      }
      if (name === 'style') {
        el.removeAttribute(attr.name);
      }
    });
  });

  return template.innerHTML;
}

export function sanitizeText(text: string): string {
  if (!text) return '';
  const cleaned = sanitizeHtml(text);
  const template = typeof document !== 'undefined' ? document.createElement('template') : null;
  if (!template) {
    return cleaned.replace(/<[^>]+>/g, '');
  }
  template.innerHTML = cleaned;
  return (template.content.textContent || '').trim();
}

export function escapeHtml(value: string): string {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function formatTitleSnippet(message: string): string {
  const snippet = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  return sanitizeText(snippet || '');
}

export function sanitizeMarkdownHtml(html: string): string {
  return sanitizeHtml(html);
}
