import { major, satisfies, valid } from 'semver';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  draft?: boolean;
}

const ACTIVE_MAJORS = new Set([1, 2]);

/**
 * Fetch the full history for an empty cache, or only the releases up to the
 * newest cached release on both active maintenance lines.
 */
export async function fetchReleases(
  request: typeof fetch = fetch,
  cutoffs: ReadonlyMap<number, string> = new Map(),
): Promise<GitHubRelease[]> {
  const releases = new Map<string, GitHubRelease>();
  const incremental = [...ACTIVE_MAJORS].every(activeMajor => cutoffs.has(activeMajor));
  const normalizedCutoffs = new Map(
    [...cutoffs].map(([releaseMajor, tag]) => [releaseMajor, valid(tag) ?? tag.replace(/^v/, '')]),
  );
  const reachedCutoffs = new Set<number>();
  const perPage = 100;
  const headers: Record<string, string> = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'flux-docs-changelog-loader',
  };
  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  for (let page = 1; ; page++) {
    const response = await request(
      `https://api.github.com/repos/fluxzero-io/fluxzero-sdk-java/releases?per_page=${perPage}&page=${page}`,
      { headers, signal: AbortSignal.timeout(15_000) },
    );
    if (!response.ok) {
      // Never replace a complete cache with a partially fetched history.
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }
    const pageReleases: GitHubRelease[] = await response.json();
    for (const release of pageReleases) {
      const version = valid(release.tag_name);
      if (!version || release.draft || !satisfies(version, '>=0.1192.0', { includePrerelease: true })) {
        continue;
      }
      const releaseMajor = major(version);
      if (incremental && ACTIVE_MAJORS.has(releaseMajor)) {
        if (reachedCutoffs.has(releaseMajor)) continue;
        if (version === normalizedCutoffs.get(releaseMajor)) reachedCutoffs.add(releaseMajor);
      }
      const body = release.body?.trim();
      if (!body || body === release.name || body === `Flux Capacitor ${version}`) {
        continue;
      }
      // Pagination can overlap if a release is published while we are fetching.
      if (!releases.has(release.tag_name)) releases.set(release.tag_name, release);
    }
    if (incremental && reachedCutoffs.size === ACTIVE_MAJORS.size) break;
    if (pageReleases.length < perPage) break;
  }
  return [...releases.values()];
}
