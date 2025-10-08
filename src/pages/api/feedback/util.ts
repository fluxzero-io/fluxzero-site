export function buildTitle(slug: string, message: string): string {
  const rawSnippet = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  const snippet = rawSnippet.replace(/[<>]/g, '');
  const suffix = `[slug:${slug}]`;
  if (!snippet) return suffix;
  return `${snippet} ${suffix}`;
}

export function sanitizeSlug(slug: string): string {
  if (!slug) throw new Error('invalid_slug');
  return slug.toLowerCase().trim().replace(/\/+$/, '');
}

export function buildBody(slug: string, selectionText: string, message: string, selectionContext?: { prefix?: string; suffix?: string }, segments?: Array<{ hash: string; start: number; end: number }>): string {
  const selected = String(selectionText || '').trim();
  const userMsg = String(message || '').trim();
  const meta: any = {
    version: 1,
    page: slug,
    selection: { text: selected },
    timestamp: new Date().toISOString(),
  };
  if (selectionContext && (selectionContext.prefix || selectionContext.suffix)) {
    meta.selection.context = {};
    if (selectionContext.prefix) meta.selection.context.prefix = selectionContext.prefix;
    if (selectionContext.suffix) meta.selection.context.suffix = selectionContext.suffix;
  }
  if (Array.isArray(segments) && segments.length > 0) {
    meta.selection.segments = segments;
  }
  return `## Documentation Feedback\n\n**Page**: [${slug}](${slug})\n**Selected Text**:\n> ${selected}\n\n## User Feedback\n${userMsg}\n\n---\n*This feedback was submitted through the documentation site.*\n\n<!-- FEEDBACK_METADATA\n${JSON.stringify(meta, null, 2)}\n-->`;
}

export function extractUserFeedbackSection(markdown: string): string {
  if (!markdown) return '';
  const normalized = markdown.replace(/\r\n?/g, '\n');
  const headingMatch = normalized.match(/^##\s+User Feedback\s*$/im);

  const sliceFrom = (source: string) => {
    const trimmedStart = source.replace(/^\n+/, '');
    const nextHeadingIndex = trimmedStart.search(/^##\s+/m);
    const delimiterIndex = trimmedStart.search(/^---\s*$/m);
    let endIndex = trimmedStart.length;
    if (delimiterIndex !== -1 && delimiterIndex < endIndex) endIndex = delimiterIndex;
    if (nextHeadingIndex !== -1 && nextHeadingIndex < endIndex) endIndex = nextHeadingIndex;
    const section = trimmedStart.slice(0, endIndex).trim();
    const withoutComments = section.replace(/<!--[\s\S]*?-->/g, '');
    const withoutTags = withoutComments.replace(/<[^>]*>/g, '');
    const cleaned = withoutTags.trim();
    const maxLength = 250;
    const ellipsis = '…';
    if (cleaned.length > maxLength) {
      const clipped = cleaned.slice(0, Math.max(0, maxLength - ellipsis.length)).trimEnd();
      return `${clipped}${ellipsis}`;
    }
    return cleaned;
  };

  if (!headingMatch) {
    return sliceFrom(normalized);
  }

  const startIndex = headingMatch.index ?? 0;
  const afterHeading = normalized.slice(startIndex + headingMatch[0].length);
  return sliceFrom(afterHeading);
}
