import { rcompare } from 'semver';

export const releasesPerPage = 20;

export function compareReleasesByDate(a, b) {
  return String(b.date).localeCompare(String(a.date)) || rcompare(a.version, b.version);
}

export function formatReleaseDate(date) {
  return new Intl.DateTimeFormat('en', {
    year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC',
  }).format(new Date(date?.length === 10 ? `${date}T00:00:00Z` : date));
}

export function changelogPageUrl(page) {
  return page === 1 ? '/docs/changelog/' : `/docs/changelog/page/${page}/`;
}

// Match the existing Starlight heading fragments for date + SemVer labels.
export function releaseAnchor(release) {
  return `${formatReleaseDate(release.date)} · ${release.version}`
    .toLowerCase().replace(/[,.·+]/g, '').replace(/ /g, '-');
}

export function paginateReleases(releases) {
  const sorted = [...releases].sort(compareReleasesByDate);
  const pages = [];
  for (let offset = 0; offset < sorted.length; offset += releasesPerPage) {
    pages.push(sorted.slice(offset, offset + releasesPerPage));
  }
  return pages;
}

export function changelogAnchorPages(pages) {
  const anchors = {};
  pages.forEach((releases, index) => {
    for (const release of releases) {
      anchors[releaseAnchor(release)] = index + 1;
      const year = String(new Date(release.date).getUTCFullYear());
      anchors[year] ??= index + 1;
    }
  });
  return anchors;
}
