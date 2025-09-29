export function buildTitle(slug: string, message: string): string {
  const snippet = String(message || '').replace(/\s+/g, ' ').trim().slice(0, 70);
  return `[slug:${slug}] ${snippet}`;
}

export function buildBody(slug: string, selectionText: string, message: string): string {
  const selected = String(selectionText || '').trim();
  const userMsg = String(message || '').trim();
  return `## Documentation Feedback\n\n**Page**: [${slug}](${slug})\n**Selected Text**:\n> ${selected}\n\n## User Feedback\n${userMsg}\n\n---\n*This feedback was submitted through the documentation site.*\n\n<!-- FEEDBACK_METADATA\n${JSON.stringify({
    version: 1,
    page: slug,
    selection: { text: selected },
    timestamp: new Date().toISOString(),
  }, null, 2)}\n-->`;
}

