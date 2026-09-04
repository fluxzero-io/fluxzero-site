import type { Loader } from 'astro/loaders';
import { z } from 'astro:content';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const GITHUB_API_BASE = 'https://api.github.com';
const REPO = 'fluxzero-io/fluxzero-sdk-java';
const CACHE_FILE = join(process.cwd(), 'src', 'data', 'changelog-cache.json');

interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
}

interface ChangelogRelease {
  version: string;
  date: string;
  body: string;
  url: string;
  quarterKey: string;
  year: number;
  quarter: string;
}

interface ChangelogCache {
  lastUpdated: string;
  latestVersion: string;
  releases: ChangelogRelease[];
}

const changelogReleaseSchema = z.object({
  version: z.string(),
  date: z.string(),
  body: z.string(),
  url: z.string(),
  quarterKey: z.string(),
  year: z.number(),
  quarter: z.string(),
});

export function changelogLoader(): Loader {
  return {
    name: 'changelog-loader',
    async load({ store, logger, parseData }) {
      logger.info("Loading changelog releases");
      
      // Check if GitHub releases are optional from npm config
      const isOptional = process.env.npm_package_config_ghreleases_optional === 'true';
      const shouldThrowErrors = !isOptional;
      
      try {
        // Clear existing store
        store.clear();
        
        // Read cached data if it exists
        const cachedData = await readCacheFile();
        let allReleases = cachedData.releases.map(normalizeChangelogRelease);
        const cacheWasNormalized = cachedData.releases.some((release, index) => {
          return release.body !== allReleases[index]?.body;
        });
        
        if (cachedData.releases.length > 0) {
          logger.info(`Found ${cachedData.releases.length} cached releases (latest: ${cachedData.latestVersion})`);
          
          // Fetch only new releases since the cached version
          const newGitHubReleases = await fetchReleases(cachedData.latestVersion);
          
          if (newGitHubReleases.length > 0) {
            logger.info(`Found ${newGitHubReleases.length} new releases`);
            
            // Process new releases
            const newReleases = newGitHubReleases.map(formatChangelogRelease);
            
            // Add new releases to the beginning (most recent first)
            allReleases = [...newReleases, ...allReleases];
            
            // Update cache file
            await writeCacheFile({
              lastUpdated: new Date().toISOString(),
              latestVersion: newReleases[0].version,
              releases: allReleases
            });
            
            logger.info(`Updated cache with ${newReleases.length} new releases`);
          } else {
            if (cacheWasNormalized) {
              await writeCacheFile({
                ...cachedData,
                releases: allReleases
              });
              logger.info("Normalized cached release notes");
            } else {
              logger.info("No new releases found, using cached data");
            }
          }
        } else {
          logger.info("No cached data found, fetching all releases");
          
          // Fetch all releases
          const gitHubReleases = await fetchReleases();
          allReleases = gitHubReleases.map(formatChangelogRelease);
          
          // Create initial cache file
          await writeCacheFile({
            lastUpdated: new Date().toISOString(),
            latestVersion: allReleases[0]?.version || '',
            releases: allReleases
          });
          
          logger.info(`Cached ${allReleases.length} releases`);
        }
        
        // Add all releases to the store
        for (const release of allReleases) {
          const data = await parseData({
            id: release.version,
            data: release
          });
          
          store.set({
            id: data.version,
            data
          });
        }
        
        logger.info(`Loaded ${allReleases.length} changelog releases`);
        
      } catch (error) {
        if (shouldThrowErrors) {
          logger.error(`Failed to load changelog: ${error}`);
          throw error;
        } else {
          logger.warn(`Failed to load changelog (continuing with cached data): ${error}`);
          
          // Try to load cached data even if GitHub API failed
          const cachedData = await readCacheFile();
          if (cachedData.releases.length > 0) {
            logger.info(`Using ${cachedData.releases.length} cached releases after GitHub API failure`);
            
            // Add cached releases to the store
            for (const release of cachedData.releases) {
              const data = await parseData({
                id: release.version,
                data: release
              });
              
              store.set({
                id: data.version,
                data
              });
            }
          } else {
            logger.warn("No cached data available and GitHub API failed - changelog will be empty");
          }
        }
      }
    }
  };
}

function parseVersion(tag: string): number[] {
  const match = tag.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  if (!match) return [0, 0, 0];
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function compareVersions(a: string, b: string): number {
  const versionA = parseVersion(a);
  const versionB = parseVersion(b);
  
  for (let i = 0; i < 3; i++) {
    if (versionA[i] !== versionB[i]) {
      return versionA[i] - versionB[i];
    }
  }
  return 0;
}

function getQuarterKey(date: string): { year: number; quarter: string; quarterNum: number } {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = d.getMonth();
  const quarterNum = Math.floor(month / 3) + 1;
  const quarter = `Q${quarterNum}`;
  
  return { year, quarter, quarterNum };
}

async function fetchReleases(sinceVersion?: string): Promise<GitHubRelease[]> {
  const releases: GitHubRelease[] = [];
  let page = 1;
  const perPage = 100;
  
  // Prepare headers with GitHub token if available
  const headers: Record<string, string> = {
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'flux-docs-changelog-loader'
  };
  
  if (process.env.GITHUB_TOKEN) {
    headers['Authorization'] = `Bearer ${process.env.GITHUB_TOKEN}`;
    console.log('Using GitHub token for API requests');
  } else {
    console.warn('No GITHUB_TOKEN found, using unauthenticated requests (rate limited)');
  }
  
  while (page <= 20) { // GitHub API has a limit
    const url = `${GITHUB_API_BASE}/repos/${REPO}/releases?per_page=${perPage}&page=${page}`;
    const response = await fetch(url, { headers });
    
    if (!response.ok) {
      if (response.status === 422 && page > 10) {
        // GitHub API pagination limit reached
        break;
      }
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    
    const pageReleases: GitHubRelease[] = await response.json();
    
    if (pageReleases.length === 0) break;
    
    let foundCutoff = false;
    for (const release of pageReleases) {
      const cleanVersion = release.tag_name.replace(/^v/, '');
      
      // Stop if we've reached a version we already have cached
      if (sinceVersion && compareVersions(sinceVersion, cleanVersion) >= 0) {
        foundCutoff = true;
        break;
      }
      
      // Skip versions before 0.1192.0
      if (compareVersions(cleanVersion, '0.1192.0') < 0) {
        foundCutoff = true;
        break;
      }
      
      // Skip releases with no meaningful content
      if (!release.body || release.body.trim().length === 0 || 
          release.body.trim() === release.name || 
          release.body.trim() === `Flux Capacitor ${cleanVersion}`) {
        continue;
      }
      
      releases.push(release);
    }
    
    if (foundCutoff) break;
    
    page++;
    
    // Respect rate limits
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return releases;
}

function formatChangelogRelease(release: GitHubRelease): ChangelogRelease {
  const version = release.tag_name.replace(/^v/, '');
  const date = getReleaseDate(release);
  
  // Get quarter information
  const { year, quarter } = getQuarterKey(date);
  const quarterKey = `${year}-${quarter}`;
  
  // Format the body content
  let body = release.body;
  
  // Increase all heading levels by 2 (h2->h4, h3->h5, etc.)
  body = body.replace(/^(#+)/gm, (match, hashes) => {
    return hashes + '##';
  });
  
  // Remove any existing version heading
  body = body.replace(/^#+\s*\[?[\d.]+\]?\s*\([\d-]+\)\s*\n/m, '');
  
  // Ensure all headings are at least h4
  body = body.replace(/^(#{1,3})\s/gm, '#### ');
  body = simplifyConventionalCommitSubjects(labelCommitLinks(compactDependencyUpdateBodies(expandCommitMessageDetails(body))));
  
  return {
    version,
    date,
    body: body.trim(),
    url: release.html_url,
    quarterKey,
    year,
    quarter,
  };
}

function normalizeChangelogRelease(release: ChangelogRelease): ChangelogRelease {
  const body = simplifyConventionalCommitSubjects(labelCommitLinks(compactDependencyUpdateBodies(expandCommitMessageDetails(release.body))));
  return body === release.body ? release : { ...release, body };
}

function getReleaseDate(release: GitHubRelease): string {
  const headingDateMatch = release.body.match(
    /^#+\s+(?:\[[^\]]+\]\([^)]+\)|\[?v?\d+\.\d+\.\d+\]?)\s+\((\d{4}-\d{2}-\d{2})\)/m
  );
  if (headingDateMatch) {
    return headingDateMatch[1];
  }

  const publishedDateMatch = release.published_at.match(/^(\d{4}-\d{2}-\d{2})/);
  return publishedDateMatch ? publishedDateMatch[1] : release.published_at;
}

function expandCommitMessageDetails(body: string): string {
  return body.replace(/<details class="commit-message-details">/g, '<details open class="commit-message-details">');
}

interface DependencyUpdate {
  name: string;
  from: string;
  to: string;
  changelogUrl: string;
}

function compactDependencyUpdateBodies(body: string): string {
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

function renderCompactDependencyBody(bodyHtml: string, summary: string): string {
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

function isAlreadyCompactDependencyBody(bodyHtml: string, bodyText: string): boolean {
  return /<strong>[\s\S]*?<\/strong>/.test(bodyHtml) &&
    (/\s->\s/.test(bodyText) || /:\s+(?:to|from)\s+\S+/i.test(bodyText)) &&
    !/updated-dependencies:|\b(?:Bumps|Updates)\b|\|\s*Package\s*\|/i.test(bodyText);
}

function renderDependencyUpdate(update: DependencyUpdate): string {
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

function parseDependencyUpdates(body: string, subject: string): DependencyUpdate[] {
  if (!isDependencyUpdate(body, subject)) {
    return [];
  }

  const updates: DependencyUpdate[] = [];
  const seen = new Set<string>();
  const addUpdate = (update?: DependencyUpdate) => {
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

function isDependencyUpdate(body: string, subject: string): boolean {
  return /updated-dependencies:/i.test(body) ||
    /^deps(?:\([^)]*\))?:\s*bump\b/i.test(subject) ||
    /^deps(?:\([^)]*\))?:\s*Update\b/i.test(subject) ||
    /\b(?:Bumps|Updates)\b[\s\S]*\bfrom\b[\s\S]*\bto\b/i.test(body);
}

function parseDependencyTableUpdates(body: string): DependencyUpdate[] {
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
    .filter((update): update is DependencyUpdate => Boolean(update));
}

function parseDependencyTextUpdates(body: string): DependencyUpdate[] {
  const updates: DependencyUpdate[] = [];
  const pattern = /\b(?:Bumps|Updates)\s+(?:\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|(.+?))\s+from\s+`?([^\s`,]+)`?\s+to\s+`?([^\s`,]+)`?\.?/gi;
  let match: RegExpExecArray | null;

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

function parseDependencySubject(subject: string, body: string): DependencyUpdate | undefined {
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

function enrichDependencyLink(update: DependencyUpdate, body: string): DependencyUpdate {
  return {
    ...update,
    changelogUrl: findDependencyChangelogUrl(body) || '',
  };
}

function findDependencyChangelogUrl(body: string): string {
  const changelog = body.match(/-\s+\[Changelog\]\(([^)]+)\)/i);
  if (changelog) {
    return changelog[1];
  }

  const releaseNotes = body.match(/-\s+\[Release notes\]\(([^)]+)\)/i);
  return releaseNotes ? releaseNotes[1] : '';
}

function normalizeDependencyName(value: string): string {
  return normalizeText(value)
    .replace(/^the\s+/i, '')
    .replace(/\s+group(?:\s+across.*)?$/i, '')
    .replace(/\s+(?:Docker digest|action)$/i, '')
    .replace(/[,.]$/g, '')
    .replace(/^deps(?:\([^)]*\))?:\s*/i, '')
    .trim();
}

function normalizeVersion(value: string): string {
  return normalizeText(value).replace(/^v(?=\d)/i, '').replace(/[,.]$/g, '');
}

function normalizeText(value: string): string {
  return (value || '').trim();
}

function htmlToText(html: string): string {
  return decodeHtml(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<a\s+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, '[$2]($1)')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<\/?p>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
}

function stripHtml(html: string): string {
  return decodeHtml(html.replace(/<[^>]+>/g, '')).trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&#8203;/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function labelCommitLinks(body: string): string {
  const placeholders: string[] = [];
  const storeCommitLink = (html: string) => {
    const index = placeholders.push(html) - 1;
    return `%%FLUXZERO_COMMIT_LINK_${index}%%`;
  };
  const renderCommitLink = (href: string) => {
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

function simplifyConventionalCommitSubjects(body: string): string {
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

function simplifyConventionalCommitSubject(subject: string): string {
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

async function readCacheFile(): Promise<ChangelogCache> {
  try {
    if (!existsSync(CACHE_FILE)) {
      return {
        lastUpdated: '',
        latestVersion: '',
        releases: []
      };
    }
    
    const content = readFileSync(CACHE_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.warn('Failed to read cache file:', error);
    return {
      lastUpdated: '',
      latestVersion: '',
      releases: []
    };
  }
}

async function writeCacheFile(cache: ChangelogCache): Promise<void> {
  try {
    // Ensure the directory exists
    mkdirSync(dirname(CACHE_FILE), { recursive: true });
    
    // Write the cache file
    writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (error) {
    console.warn('Failed to write cache file:', error);
  }
}
