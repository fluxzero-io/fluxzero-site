#!/usr/bin/env node
import { mkdir, readdir, readFile, rm, stat, copyFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { compareReleasesByDate, formatReleaseDate, changelogPageUrl, paginateReleases, changelogAnchorPages } from './changelog-pagination.mjs';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const defaultSource = path.resolve(repoRoot, '..', 'fluxzero-sdk-java', 'docs', 'developer');
const sourceDir = path.resolve(repoRoot, process.env.FLUXZERO_SDK_DOCS_SOURCE ?? defaultSource);
const targetDir = path.join(repoRoot, 'src', 'content', 'docs', 'docs');
const changelogCacheFile = path.join(repoRoot, 'src', 'data', 'changelog-cache.json');
const changelogTargetFile = path.join(targetDir, 'about', 'changelog.mdx');

async function pathExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') {
      return false;
    }
    throw error;
  }
}

async function copyDirectory(source, target) {
  await mkdir(target, { recursive: true });
  let mdxCount = 0;
  for (const entry of await readdir(source, { withFileTypes: true })) {
    if (entry.name === '.DS_Store' || entry.name === '.git') {
      continue;
    }
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);
    if (entry.isDirectory()) {
      mdxCount += await copyDirectory(sourcePath, targetPath);
    } else if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
      if (entry.name.endsWith('.mdx')) {
        mdxCount += 1;
      }
    }
  }
  return mdxCount;
}

function escapeAttribute(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

function expandCommitMessageDetails(body) {
  return body.replace(/<details class="commit-message-details">/g, '<details open class="commit-message-details">');
}

function compactDependencyUpdateBodies(body) {
  return body.replace(
    /<details(?:\s+open)?\s+class="commit-message-details"><summary>([\s\S]*?)<\/summary>\s*<div class="commit-message-body">\s*([\s\S]*?)\s*<\/div>\s*<\/details>/g,
    (match, summary, bodyHtml) => {
      const dependencyBody = renderCompactDependencyBody(bodyHtml, stripHtml(summary));
      if (!dependencyBody) {
        return match;
      }
      return `<details open class="commit-message-details"><summary>${summary}</summary>\n${dependencyBody}\n</details>`;
    }
  );
}

function renderCompactDependencyBody(bodyHtml, summary) {
  const bodyText = htmlToText(bodyHtml);
  if (isAlreadyCompactDependencyBody(bodyHtml, bodyText)) {
    return '';
  }

  const updates = parseDependencyUpdates(bodyText, summary);
  if (updates.length === 0) {
    return '';
  }

  if (updates.length === 1) {
    return `<div class="commit-message-body">\n<p>${renderDependencyUpdate(updates[0])}</p>\n</div>`;
  }

  const items = updates.map((update) => `<li>${renderDependencyUpdate(update)}</li>`).join('\n');
  return `<div class="commit-message-body">\n<ul>\n${items}\n</ul>\n</div>`;
}

function isAlreadyCompactDependencyBody(bodyHtml, bodyText) {
  return /<strong>[\s\S]*?<\/strong>/.test(bodyHtml) &&
    (/\s->\s/.test(bodyText) || /:\s+(?:to|from)\s+\S+/i.test(bodyText)) &&
    !/updated-dependencies:|\b(?:Bumps|Updates)\b|\|\s*Package\s*\|/i.test(bodyText);
}

function renderDependencyUpdate(update) {
  let versionChange = '';
  if (update.from && update.to) {
    versionChange = `: ${escapeHtml(update.from)} -> ${escapeHtml(update.to)}`;
  } else if (update.to) {
    versionChange = `: to ${escapeHtml(update.to)}`;
  } else if (update.from) {
    versionChange = `: from ${escapeHtml(update.from)}`;
  }
  const changelogLink = update.changelogUrl
    ? ` <a href="${escapeHtml(update.changelogUrl)}">changelog</a>`
    : '';
  return `<strong>${escapeHtml(update.name)}</strong>${versionChange}${changelogLink}`;
}

function parseDependencyUpdates(body, subject) {
  if (!isDependencyUpdate(body, subject)) {
    return [];
  }

  const updates = [];
  const seen = new Set();
  const addUpdate = (update) => {
    if (!update?.name || /dependency-updates group/i.test(update.name)) {
      return;
    }
    const key = `${update.name}\0${update.from}\0${update.to}`;
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    updates.push(update);
  };

  for (const update of parseDependencyTextUpdates(body)) {
    addUpdate(update);
  }

  for (const update of parseDependencyTableUpdates(body)) {
    addUpdate(update);
  }

  if (updates.length === 0) {
    addUpdate(parseDependencySubject(subject, body));
  }

  return updates;
}

function isDependencyUpdate(body, subject) {
  return /updated-dependencies:/i.test(body) ||
    /^deps(?:\([^)]*\))?:\s*bump\b/i.test(subject) ||
    /^deps(?:\([^)]*\))?:\s*Update\b/i.test(subject) ||
    /\b(?:Bumps|Updates)\b[\s\S]*\bfrom\b[\s\S]*\bto\b/i.test(body);
}

function parseDependencyTableUpdates(body) {
  return body
    .split(/\r?\n/)
    .map((line) => {
      const match = line.match(/^\|\s*(?:\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|([^|`]+?))\s*\|\s*`?([^`|]+?)`?\s*\|\s*`?([^`|]+?)`?\s*\|$/);
      if (!match) {
        return undefined;
      }

      const [, linkedName, , tickedName, plainName, from, to] = match;
      const name = normalizeDependencyName(linkedName || tickedName || plainName);
      if (!name || /^Package$/i.test(name) || /^-+$/.test(name)) {
        return undefined;
      }

      return {
        name,
        from: normalizeVersion(from),
        to: normalizeVersion(to),
        changelogUrl: '',
      };
    })
    .filter(Boolean);
}

function parseDependencyTextUpdates(body) {
  const updates = [];
  const pattern = /\b(?:Bumps|Updates)\s+(?:\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|(.+?))\s+from\s+`?([^\s`,]+)`?\s+to\s+`?([^\s`,]+)`?\.?/gi;
  let match;

  while ((match = pattern.exec(body)) !== null) {
    const [, linkedName, , tickedName, plainName, from, to] = match;
    const name = normalizeDependencyName(linkedName || tickedName || plainName);
    if (!name) {
      continue;
    }

    const nextBody = body.slice(match.index);
    const nextUpdateIndex = nextBody.slice(1).search(/\n\s*(?:Bumps|Updates)\s+/i);
    const block = nextUpdateIndex === -1 ? nextBody : nextBody.slice(0, nextUpdateIndex + 1);
    updates.push(enrichDependencyLink({
      name,
      from: normalizeVersion(from),
      to: normalizeVersion(to),
      changelogUrl: '',
    }, block));
  }

  return updates;
}

function parseDependencySubject(subject, body) {
  const bumpMatch = subject.match(/\bbump\s+(.+?)\s+from\s+([^\s]+)\s+to\s+([^\s()]+)(?:\s+\([^)]*\))*\.?$/i) ||
    subject.match(/\bbump\s+(.+?)(?:\s+\([^)]*\))*\.?$/i);
  if (bumpMatch) {
    return enrichDependencyLink({
      name: normalizeDependencyName(bumpMatch[1]),
      from: normalizeVersion(bumpMatch[2] || ''),
      to: normalizeVersion(bumpMatch[3] || ''),
      changelogUrl: '',
    }, body);
  }

  const updateMatch = subject.match(/\bUpdate\s+(?:dependency\s+)?(.+?)\s+to\s+v?([^\s()]+)(?:\s+\([^)]*\))*$/i);
  if (updateMatch) {
    return enrichDependencyLink({
      name: normalizeDependencyName(updateMatch[1]),
      from: '',
      to: normalizeVersion(updateMatch[2] || ''),
      changelogUrl: '',
    }, body);
  }

  return undefined;
}

function enrichDependencyLink(update, body) {
  return {
    ...update,
    changelogUrl: findDependencyChangelogUrl(body) || '',
  };
}

function findDependencyChangelogUrl(body) {
  const changelog = body.match(/-\s+\[Changelog\]\(([^)]+)\)/i);
  if (changelog) {
    return changelog[1];
  }

  const releaseNotes = body.match(/-\s+\[Release notes\]\(([^)]+)\)/i);
  return releaseNotes ? releaseNotes[1] : '';
}

function normalizeDependencyName(value) {
  return normalizeText(value)
    .replace(/^the\s+/i, '')
    .replace(/\s+group(?:\s+across.*)?$/i, '')
    .replace(/\s+(?:Docker digest|action)$/i, '')
    .replace(/[,.]$/g, '')
    .replace(/^deps(?:\([^)]*\))?:\s*/i, '')
    .trim();
}

function normalizeVersion(value) {
  return normalizeText(value).replace(/^v(?=\d)/i, '').replace(/[,.]$/g, '');
}

function normalizeText(value) {
  return (value || '').trim();
}

function htmlToText(html) {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function stripHtml(html) {
  return decodeHtml(html.replace(/<[^>]+>/g, '')).trim();
}

function decodeHtml(value) {
  return value
    .replace(/&#8203;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function labelCommitLinks(body) {
  const placeholders = [];
  const storeCommitLink = (html) => {
    const index = placeholders.push(html) - 1;
    return `%%FLUXZERO_COMMIT_LINK_${index}%%`;
  };
  const renderCommitLink = (href) => {
    return `<span class="commit-link-wrap">(<a class="commit-link" href="${href}" target="_blank" rel="noreferrer">GitHub</a>)</span>`;
  };

  return body
    .replace(
      /(?:<span class="commit-link-wrap">)+\(<a class="commit-link" href="([^"]*\/commit\/[^"]+)"(?:\s+target="[^"]*")?(?:\s+rel="[^"]*")?>(?:commit|github|GitHub)<\/a>\)(?:<\/span>)+/g,
      (_, href) => storeCommitLink(renderCommitLink(href))
    )
    .replace(
      /\(<a href="([^"]*\/commit\/[^"]+)"><code>[0-9a-f]{7,40}<\/code><\/a>\)/g,
      (_, href) => storeCommitLink(renderCommitLink(href))
    )
    .replace(
      /\(<a class="commit-link" href="([^"]*\/commit\/[^"]+)"(?:\s+target="[^"]*")?(?:\s+rel="[^"]*")?>(?:commit|github|GitHub)<\/a>\)/g,
      (_, href) => storeCommitLink(renderCommitLink(href))
    )
    .replace(
      /<a class="commit-link" href="([^"]*\/commit\/[^"]+)"(?:\s+target="[^"]*")?(?:\s+rel="[^"]*")?>(?:commit|github|GitHub)<\/a>/g,
      (_, href) => storeCommitLink(`<a class="commit-link" href="${href}" target="_blank" rel="noreferrer">GitHub</a>`)
    )
    .replace(
      /%%FLUXZERO_COMMIT_LINK_(\d+)%%/g,
      (_, index) => placeholders[Number(index)] ?? ''
    );
}

function simplifyConventionalCommitSubjects(body) {
  return body
    .replace(
      /(<summary>)([^<]*?)(?=\s*(?:<span class="commit-link-wrap"|<\/summary>))/g,
      (_, prefix, subject) => `${prefix}${simplifyConventionalCommitSubject(subject)}`
    )
    .replace(
      /(<li>)(?!<)([^<]*?)(?=\s*(?:<span class="commit-link-wrap"|<\/li>))/g,
      (_, prefix, subject) => `${prefix}${simplifyConventionalCommitSubject(subject)}`
    );
}

const conventionalCommitTypes = new Set([
  'build',
  'chore',
  'ci',
  'deps',
  'docs',
  'feat',
  'fix',
  'perf',
  'refactor',
  'style',
  'test',
]);

function simplifyConventionalCommitSubject(subject) {
  const match = subject.match(/^(\s*)([a-z]+)(?:\(([^)]+)\))?!?:\s+(.+)$/i);
  if (!match) {
    return subject;
  }

  const [, leading, type, scope, summary] = match;
  if (!conventionalCommitTypes.has(type.toLowerCase())) {
    return subject;
  }

  return scope ? `${leading}${scope}: ${summary}` : `${leading}${summary}`;
}

function normalizeReleaseBody(body) {
  return simplifyConventionalCommitSubjects(labelCommitLinks(compactDependencyUpdateBodies(expandCommitMessageDetails(body))));
}

function groupReleasesByYear(releases) {
  const yearGroups = new Map();

  for (const release of [...releases].sort(compareReleasesByDate)) {
    const date = new Date(release.date?.length === 10 ? `${release.date}T00:00:00Z` : release.date);
    const year = Number.isFinite(date.getUTCFullYear()) ? date.getUTCFullYear() : release.year;
    if (!yearGroups.has(year)) {
      yearGroups.set(year, []);
    }
    yearGroups.get(year).push(release);
  }

  return [...yearGroups.entries()]
    .sort(([yearA], [yearB]) => yearB - yearA)
    .map(([year, releases]) => ({ year, releases }));
}

function renderChangelogPage(releases, page, totalPages, anchorPages) {
  const pagination = `<nav class="changelog-pagination" aria-label="Changelog pages">
    ${page > 1 ? `<a href="${changelogPageUrl(page - 1)}" rel="prev">← Newer</a>` : '<span></span>'}
    <span>Page ${page} of ${totalPages}</span>
    ${page < totalPages ? `<a href="${changelogPageUrl(page + 1)}" rel="next">Older →</a>` : '<span></span>'}
  </nav>`;
  const yearGroups = groupReleasesByYear(releases);
  const styles = `
  .changelog-pagination {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 0.75rem;
    margin-block: 1.5rem;
    padding-block: 1rem;
    border-block: 1px solid var(--sl-color-gray-6);
    font-size: var(--sl-text-sm);
  }
  .changelog-pagination a {
    font-weight: 600;
    text-decoration: none;
    padding-block: 0.5rem;
  }
  .changelog-pagination a:hover { text-decoration: underline; }
  .changelog-pagination > span { color: var(--sl-color-gray-2); }
  .changelog-pagination--toc {
    margin: 0.5rem 0;
    padding: 0.25rem 0;
    font-size: var(--sl-text-xs);
  }
  .changelog-pagination--toc a { color: var(--sl-color-text-accent); }
  mobile-starlight-toc .changelog-pagination--toc {
    margin: 0;
    padding: 0.5rem 1rem;
    position: sticky;
    top: 0;
    background: var(--sl-color-black);
  }
  .changelog-intro { color: var(--sl-color-gray-2); }

  .changelog-year {
    margin-top: 1.15rem;
  }

  .changelog-release-list {
    display: grid;
    gap: 0;
    margin-top: 1.15rem;
  }

  .changelog-release-item {
    display: grid;
    grid-template-columns: minmax(4.75rem, 6.75rem) 1.35rem minmax(0, 1fr);
    gap: 0 0.85rem;
    position: relative;
  }

  .changelog-release-date {
    padding-top: 0.95rem;
    color: var(--sl-color-gray-3);
    font-size: 0.78rem;
    font-weight: 700;
    line-height: 1.25;
    text-align: right;
    white-space: nowrap;
  }

  .changelog-release-spine {
    position: relative;
    min-height: 100%;
  }

  .changelog-release-spine::before {
    content: "";
    position: absolute;
    top: 0;
    bottom: 0;
    left: 50%;
    width: 1px;
    transform: translateX(-50%);
    background: var(--sl-color-gray-6);
  }

  .changelog-release-spine::after {
    content: "";
    position: absolute;
    top: 1.05rem;
    left: 50%;
    width: 0.55rem;
    height: 0.55rem;
    border: 2px solid var(--sl-color-accent);
    border-radius: 999px;
    transform: translateX(-50%);
    background: var(--sl-color-bg);
  }

  .changelog-release-item:first-child .changelog-release-spine::before {
    top: 1.05rem;
  }

  .changelog-release-item:last-child .changelog-release-spine::before {
    bottom: calc(100% - 1.45rem);
  }

  .changelog-release {
    position: relative;
    margin-bottom: 0.9rem;
    border: 1px solid var(--sl-color-gray-6);
    border-radius: 0.5rem;
    background: var(--sl-color-bg);
  }

  .changelog-release[open] {
    border-color: color-mix(in srgb, var(--sl-color-accent) 26%, var(--sl-color-gray-6));
    background: color-mix(in srgb, var(--sl-color-bg-nav) 55%, var(--sl-color-bg));
  }

  .changelog-release > summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    gap: 0.65rem;
    align-items: center;
    min-height: 3rem;
    padding: 0.72rem 0.85rem;
    cursor: pointer;
    list-style: none;
  }

  .changelog-release > summary::-webkit-details-marker {
    display: none;
  }

  .changelog-release > summary::marker {
    content: "";
  }

  .changelog-release > summary:focus {
    outline: none;
  }

  .changelog-release > summary:focus-visible {
    outline: 2px solid var(--sl-color-accent);
    outline-offset: -2px;
    border-radius: 0.45rem;
  }

  .changelog-release > summary::before {
    content: "";
    width: 1.05rem;
    height: 1.05rem;
    background: var(--sl-color-accent-high);
    clip-path: polygon(88% 50%, 18% 6%, 18% 94%);
    transition: clip-path 120ms ease;
  }

  .changelog-release[open] > summary::before {
    clip-path: polygon(50% 90%, 4% 18%, 96% 18%);
  }

  .changelog-release > summary h3 {
    margin: 0;
    color: var(--sl-color-accent-high);
    font-size: 1.02rem;
    font-weight: 750;
    letter-spacing: 0;
    line-height: 1.35;
    scroll-margin-top: calc(var(--sl-nav-height) + 1rem);
  }

  .changelog-release > summary .sl-anchor-link {
    display: none;
  }

  .changelog-release__toc-date {
    position: absolute;
    width: 1px;
    height: 1px;
    margin: -1px;
    padding: 0;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .changelog-toc-release-label {
    display: inline-block;
    max-width: 100%;
  }

  .changelog-toc-release {
    display: inline-flex;
    gap: 0.32rem;
    align-items: center;
    max-width: 100%;
    vertical-align: baseline;
  }

  .changelog-toc-release::before {
    content: "";
    flex: 0 0 auto;
    width: 0.86em;
    height: 0.86em;
    color: var(--sl-color-gray-3);
    background: currentColor;
    transform: translateY(0.04em);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round' d='M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.1' stroke-linecap='round' stroke-linejoin='round' d='M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42zM7.5 7.5h.01'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .changelog-toc-release__version {
    min-width: 0;
    overflow: hidden;
    font-variant-numeric: tabular-nums;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .changelog-toc-release__separator {
    color: var(--sl-color-gray-3);
    font: inherit;
    white-space: nowrap;
  }

  .changelog-toc-release__date {
    font: inherit;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
  }

  .changelog-release__link,
  .commit-link {
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 700;
    text-decoration: none;
    white-space: nowrap;
  }

  .changelog-release__link {
    display: inline-flex;
    gap: 0.25rem;
    align-items: center;
    padding: 0.18rem 0.48rem 0.18rem 0.55rem;
    border: 1px solid var(--sl-color-gray-6);
    color: var(--sl-color-gray-2);
    background: var(--sl-color-bg);
  }

  .changelog-release__link::after {
    content: "";
    display: block;
    flex: 0 0 auto;
    width: 0.76rem;
    height: 0.76rem;
    background: currentColor;
    transform: translateY(-0.04rem);
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M7 17 17 7M9 7h8v8'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M7 17 17 7M9 7h8v8'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .changelog-release__link:hover,
  .commit-link:hover {
    color: var(--sl-color-accent-high);
    border-color: var(--sl-color-accent-low);
  }

  .changelog-release__body {
    padding: 0 1rem 1rem 2rem;
  }

  .changelog-release__body > h4:first-child {
    display: none;
  }

  .changelog-release__body h5 {
    margin: 0.95rem 0 0.4rem;
    color: var(--sl-color-white);
    font-size: 0.9rem;
    letter-spacing: 0;
  }

  .changelog-release__body > ul {
    display: grid;
    gap: 0.38rem;
    margin: 0.25rem 0 0;
    padding-left: 0;
    list-style: none;
  }

  .changelog-release__body > ul > li {
    position: relative;
    min-width: 0;
    padding-left: 1.55rem;
  }

  .changelog-release__body > ul > li::before,
  .commit-message-details > summary::before {
    content: "";
    position: absolute;
    top: 0.42em;
    left: 0.02rem;
    width: 0.78rem;
    height: 0.78rem;
    background: currentColor;
    transform-origin: center;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.75' stroke-linecap='round' stroke-linejoin='round' d='m9 18 6-6-6-6'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.75' stroke-linecap='round' stroke-linejoin='round' d='m9 18 6-6-6-6'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  .changelog-release__body > ul > li::before {
    color: var(--sl-color-gray-2);
    opacity: 0.9;
    transform: rotate(90deg);
  }

  .changelog-release__body > ul > li:has(> .commit-message-details) {
    padding-left: 0;
  }

  .changelog-release__body > ul > li:has(> .commit-message-details)::before {
    display: none;
  }

  .commit-message-details {
    margin: 0;
  }

  .commit-message-details > summary {
    position: relative;
    padding-left: 1.55rem;
    cursor: pointer;
    list-style: none;
    font-size: 0.92rem;
    line-height: 1.55;
  }

  .commit-message-details > summary::-webkit-details-marker {
    display: none;
  }

  .commit-message-details > summary::marker {
    content: "";
  }

  .commit-message-details > summary::before {
    color: var(--sl-color-accent-high);
    opacity: 1;
  }

  .commit-message-details[open] > summary::before {
    transform: rotate(90deg);
  }

  .commit-message-body {
    margin: 0.45rem 0 0.15rem;
    padding: 0.65rem 0.75rem;
    border: 1px solid var(--sl-color-gray-6);
    border-radius: 0.5rem;
    background: var(--sl-color-bg);
    overflow-wrap: anywhere;
  }

  .commit-message-body > p {
    margin: 0 0 0.75rem;
  }

  .commit-message-body > p:last-child {
    margin-bottom: 0;
  }

  .commit-message-body ul {
    margin: 0.25rem 0 0;
    padding-left: 1.1rem;
  }

  .commit-message-body li + li {
    margin-top: 0.25rem;
  }

  .commit-link {
    display: inline-flex;
    gap: 0.2rem;
    align-items: center;
    color: var(--sl-color-accent-high);
  }

  .commit-link-wrap {
    white-space: nowrap;
  }

  .commit-link::after {
    content: "";
    width: 0.76rem;
    height: 0.76rem;
    background: currentColor;
    -webkit-mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M7 17 17 7M9 7h8v8'/%3E%3C/svg%3E") center / contain no-repeat;
    mask: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='none' stroke='black' stroke-width='2.25' stroke-linecap='round' stroke-linejoin='round' d='M7 17 17 7M9 7h8v8'/%3E%3C/svg%3E") center / contain no-repeat;
  }

  @media (max-width: 42rem) {
    .changelog-release-item {
      grid-template-columns: 1.15rem minmax(0, 1fr);
      gap: 0 0.75rem;
    }

    .changelog-release-date {
      grid-column: 2;
      grid-row: 1;
      padding: 0 0 0.35rem;
      text-align: left;
    }

    .changelog-release-spine {
      grid-column: 1;
      grid-row: 1 / span 2;
    }

    .changelog-release {
      grid-column: 2;
      grid-row: 2;
    }

    .changelog-release > summary {
      padding-right: 1rem;
      grid-template-columns: auto minmax(0, 1fr);
    }

    .changelog-release__link {
      grid-column: 2;
      width: max-content;
    }

    .changelog-release__body {
      padding-left: 1rem;
    }
  }
`;
  const tocScript = String.raw`
(() => {
  const releasePattern = /^([A-Z][a-z]{2} \d{1,2}, \d{4})\s*·\s*(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?)$/;
  const tocLabelSelector = ".right-sidebar a[href^='#'] > span, mobile-starlight-toc a[href^='#'] > span";

  const anchorPages = ${JSON.stringify(anchorPages)};
  const followReleaseAnchor = () => {
    let anchor;
    try { anchor = decodeURIComponent(location.hash.slice(1)); } catch { return; }
    if (!anchor || document.getElementById(anchor)) return;
    const targetPage = anchorPages[anchor];
    if (typeof targetPage !== "number" || targetPage === ${page}) return;
    const target = targetPage === 1 ? "/docs/changelog/" : "/docs/changelog/page/" + targetPage + "/";
    location.replace(target + location.hash);
  };
  window.addEventListener("hashchange", followReleaseAnchor);
  const formatChangelogToc = () => {
    followReleaseAnchor();
    const pagination = document.querySelector(".changelog-pagination:not(.changelog-pagination--toc)");
    if (pagination) {
      document.querySelectorAll("starlight-toc > nav, mobile-starlight-toc .dropdown").forEach((container) => {
        if (container.querySelector(".changelog-pagination--toc")) return;
        const pager = pagination.cloneNode(true);
        pager.classList.add("changelog-pagination--toc");
        container.insertBefore(pager, container.querySelector("ul"));
      });
    }
    document.querySelectorAll(tocLabelSelector).forEach((label) => {
      if (label.classList.contains("changelog-toc-release-label")) return;

      const match = (label.textContent || "").trim().replace(/\s+/g, " ").match(releasePattern);
      if (!match) return;

      const wrapper = document.createElement("span");
      wrapper.className = "changelog-toc-release";

      const version = document.createElement("span");
      version.className = "changelog-toc-release__version";
      version.textContent = match[2];

      const separator = document.createElement("span");
      separator.className = "changelog-toc-release__separator";
      separator.textContent = "-";

      const date = document.createElement("span");
      date.className = "changelog-toc-release__date";
      date.textContent = match[1];

      wrapper.append(version, separator, date);
      label.classList.add("changelog-toc-release-label");
      label.replaceChildren(wrapper);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", formatChangelogToc, { once: true });
  } else {
    formatChangelogToc();
  }
  document.addEventListener("astro:page-load", formatChangelogToc);
})();
`;

  const sections = yearGroups.map(({ year, releases }) => {
    const releaseItems = releases.map((release) => {
      const formattedDate = formatReleaseDate(release.date);
      return `<div class="changelog-release-item">
  <time class="changelog-release-date" datetime="${escapeAttribute(release.date)}">${escapeAttribute(formattedDate)}</time>
  <span class="changelog-release-spine" aria-hidden="true"></span>
  <details class="changelog-release" open>
    <summary>

### <span class="changelog-release__toc-date">${escapeAttribute(formattedDate)} · </span>${escapeAttribute(release.version)}

<a class="changelog-release__link" href="${escapeAttribute(release.url)}" target="_blank" rel="noreferrer"><span>GitHub</span></a>
    </summary>
    <div class="changelog-release__body" set:html={renderChangelogBody(releaseBodies[${JSON.stringify(release.version)}] ?? '', ${JSON.stringify(release.version)})} />
  </details>
</div>`;
    }).join('\n\n');

    return `## ${year}

<div class="changelog-year">
  <div class="changelog-release-list">
${releaseItems}
  </div>
</div>`;
  }).join('\n\n');

  return `---
title: ${page === 1 ? 'Changelog' : `Changelog — page ${page}`}
description: Fluxzero SDK release history, page ${page} of ${totalPages}
slug: ${changelogPageUrl(page).replace(/^\/|\/$/g, '')}
sidebar:
  order: 05
  hidden: ${page > 1}
prev: false
next: false
tableOfContents:
  minHeadingLevel: 2
  maxHeadingLevel: 3
---

import { renderChangelogBody } from '~/utils/changelog-body.mjs';

import releaseBodies from './changelog-release-bodies${page === 1 ? '' : `-${page}`}.json';
export const changelogTocScript = ${JSON.stringify(tocScript)};

<style>{\`${styles}\`}</style>

<script is:inline set:html={changelogTocScript}></script>

<p class="changelog-intro">New features, improvements, and fixes in the Fluxzero SDK.</p>

${pagination}

${sections}

${pagination}
`;
}

async function generateChangelogPage() {
  if (!(await pathExists(changelogCacheFile))) {
    return false;
  }

  const cache = JSON.parse(await readFile(changelogCacheFile, 'utf8'));
  if (!Array.isArray(cache.releases) || cache.releases.length === 0) {
    return false;
  }

  const pages = paginateReleases(cache.releases);
  const anchorPages = changelogAnchorPages(pages);
  for (const [index, releases] of pages.entries()) {
    const page = index + 1;
    const suffix = page === 1 ? '' : `-${page}`;
    // Each MDX page imports only the bodies it renders.
    const releaseBodies = Object.fromEntries(
      releases.map((release) => [release.version, normalizeReleaseBody(release.body)])
    );
    await writeFile(path.join(path.dirname(changelogTargetFile), `changelog-release-bodies${suffix}.json`),
      JSON.stringify(releaseBodies), 'utf8');
    await writeFile(path.join(path.dirname(changelogTargetFile), `changelog${suffix}.mdx`),
      renderChangelogPage(releases, page, pages.length, anchorPages), 'utf8');
  }
  return true;
}

if (!(await pathExists(sourceDir))) {
  console.error(
    'Fluxzero SDK docs not found at ' + sourceDir + '. ' +
      'Set FLUXZERO_SDK_DOCS_SOURCE or check out fluxzero-sdk-java next to this repo.',
  );
  process.exit(1);
}

await rm(targetDir, { recursive: true, force: true });
const mdxCount = await copyDirectory(sourceDir, targetDir);
const generatedChangelog = await generateChangelogPage();

if (mdxCount === 0) {
  console.error('No MDX docs found in ' + sourceDir + '.');
  process.exit(1);
}

console.log('Synced ' + mdxCount + ' SDK docs pages from ' + sourceDir + ' to ' + targetDir + '.');
if (generatedChangelog) {
  console.log('Generated paginated changelog from ' + changelogCacheFile + '.');
}
