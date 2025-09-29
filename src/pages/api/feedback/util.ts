export function buildTitle(slug: string, message: string): string {
  const snippet = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  return `[slug:${slug}] ${snippet}`;
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
