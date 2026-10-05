import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { changelogAnchorPages, paginateReleases } from '../../scripts/changelog-pagination.mjs';

const originalDirectory = process.cwd();
const originalFetch = globalThis.fetch;
const originalOptional = process.env.npm_package_config_ghreleases_optional;
const directory = mkdtempSync(join(tmpdir(), 'changelog-test-'));
process.chdir(directory);
const { changelogLoader } = await import('./changelog-loader');
const cacheFile = join(directory, 'src/data/changelog-cache.json');
mkdirSync(join(directory, 'src/data'), { recursive: true });
after(() => {
  process.chdir(originalDirectory);
  globalThis.fetch = originalFetch;
  if (originalOptional === undefined) delete process.env.npm_package_config_ghreleases_optional;
  else process.env.npm_package_config_ghreleases_optional = originalOptional;
  rmSync(directory, { recursive: true, force: true });
});

test('renaming GitHub releases preserves content, dates, links, cache and navigation', async () => {
  const releases = [
    {
      tag_name: '2.15.1', name: 'Fluxzero 2.15.1',
      body: '## [2.15.1](https://example.com/compare) (2026-10-05)\n\n### Bug Fixes\n\n- Retain context',
      published_at: '2026-10-05T00:15:00Z', html_url: 'https://example.com/releases/tag/2.15.1',
    },
    {
      tag_name: '2.0.0-rc.20', name: 'Fluxzero 2.0.0-rc.20',
      body: '### Features\n\n- Candidate feature',
      published_at: '2026-09-30T23:45:00Z', html_url: 'https://example.com/releases/tag/2.0.0-rc.20',
    },
    {
      tag_name: 'v1.239.0', name: 'Fluxzero 1.239.0',
      // Imported releases retain their historical changelog date on the website.
      body: '## 1.239.0 (2026-06-30)\n\n### Bug Fixes\n\n- Maintenance fix',
      published_at: '2026-07-03T12:00:00Z', html_url: 'https://example.com/releases/tag/v1.239.0',
    },
  ];
  const stored = new Map<string, any>();
  const loader = changelogLoader();
  const context = {
    store: { clear: () => stored.clear(), set: ({ id, data }: { id: string; data: unknown }) => stored.set(id, data) },
    logger: { info() {}, warn() {}, error() {} },
    parseData: async ({ data }: { data: unknown }) => data,
  } as unknown as Parameters<typeof loader.load>[0];
  globalThis.fetch = async () => Response.json(releases);
  await loader.load(context);
  const before = [...stored.values()];
  const cacheBefore = readFileSync(cacheFile, 'utf8');
  const navigationBefore = changelogAnchorPages(paginateReleases(before));

  const titles = ['2.15.1 – Oct 5, 2026', '2.0.0-rc.20 – Sep 30, 2026', 'v1.239.0 – Jul 3, 2026'];
  globalThis.fetch = async () => Response.json(releases.map((release, i) => ({ ...release, name: titles[i] })));
  await loader.load(context);
  assert.deepEqual([...stored.keys()], ['2.15.1', '2.0.0-rc.20', '1.239.0']);
  assert.deepEqual([...stored.values()].map(r => r.date), ['2026-10-05', '2026-09-30', '2026-06-30']);
  assert.deepEqual([...stored.values()].map(r => r.url), releases.map(r => r.html_url));
  assert.deepEqual([...stored.values()], before);
  assert.deepEqual(changelogAnchorPages(paginateReleases([...stored.values()])), navigationBefore);
  assert.equal(readFileSync(cacheFile, 'utf8'), cacheBefore);
});

test('repairs an incomplete cache and preserves it when a later synchronization fails', async () => {
  const versions = ['1.257.0', '2.0.0-RC6', ...Array.from({ length: 13 }, (_, n) => `1.239.${n}`)];
  const releases = versions.map(tag_name => ({
    tag_name, name: tag_name, body: '## Changes\n\nRestored notes',
    published_at: '2026-09-07T00:00:00Z', html_url: `https://example.com/${tag_name}`,
  }));
  // Reproduce an existing latest-version cache that is missing all older releases.
  writeFileSync(cacheFile, JSON.stringify({ latestVersion: '1.257.0', lastUpdated: '', releases: [{
    version: '1.257.0', body: 'Old notes', date: '2026-09-07', url: 'https://example.com/1.257.0',
    quarterKey: '2026-Q3', year: 2026, quarter: 'Q3',
  }] }));
  globalThis.fetch = async () => Response.json(releases);
  const stored = new Map<string, unknown>();
  const loader = changelogLoader();
  const context = {
    store: { clear: () => stored.clear(), set: ({ id, data }: { id: string; data: unknown }) => stored.set(id, data) },
    logger: { info() {}, warn() {}, error() {} },
    parseData: async ({ data }: { data: unknown }) => data,
  } as unknown as Parameters<typeof loader.load>[0];
  await loader.load(context);
  assert.deepEqual([...stored.keys()], versions);
  const completeCache = readFileSync(cacheFile, 'utf8');
  assert.equal(JSON.parse(completeCache).releases.length, 15);
  assert.match(JSON.parse(completeCache).releases[0].body, /Restored notes/);

  globalThis.fetch = async () => new Response('Unavailable', { status: 503 });
  process.env.npm_package_config_ghreleases_optional = 'false';
  await assert.rejects(async () => loader.load(context), /GitHub API error: 503/);
  assert.equal(readFileSync(cacheFile, 'utf8'), completeCache);

  process.env.npm_package_config_ghreleases_optional = 'true';
  await loader.load(context);
  assert.deepEqual([...stored.keys()], versions);
  assert.equal(readFileSync(cacheFile, 'utf8'), completeCache);
});
