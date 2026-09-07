import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
