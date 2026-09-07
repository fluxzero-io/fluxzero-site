import { satisfies, valid } from 'semver';

export interface GitHubRelease {
  tag_name: string;
  name: string;
  body: string;
  published_at: string;
  html_url: string;
  draft?: boolean;
}

/** Fetch the full history; GitHub's release order is not semantic version order. */
export async function fetchReleases(request: typeof fetch = fetch): Promise<GitHubRelease[]> {
  const releases = new Map<string, GitHubRelease>();
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
      { headers },
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
      const body = release.body?.trim();
      if (!body || body === release.name || body === `Flux Capacitor ${version}`) {
        continue;
      }
      // Pagination can overlap if a release is published while we are fetching.
      if (!releases.has(release.tag_name)) releases.set(release.tag_name, release);
    }
    if (pageReleases.length < perPage) break;
  }
  return [...releases.values()];
}
