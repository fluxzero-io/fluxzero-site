import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fetchReleases, type GitHubRelease } from './github-releases';

function release(tag_name: string, overrides: Partial<GitHubRelease> = {}): GitHubRelease {
  return {
    tag_name, name: `Fluxzero ${tag_name}`, body: 'Release notes',
    published_at: '2026-09-07T00:00:00Z', html_url: `https://example.com/${tag_name}`,
    ...overrides,
  };
}

function api(pages: GitHubRelease[][]): typeof fetch {
  return async (url) => {
    const page = Number(new URL(String(url)).searchParams.get('page'));
    assert.ok(page <= pages.length, 'unexpected extra API request');
    return Response.json(pages[page - 1]);
  };
}

test('keeps releases after RCs, unknown tags, and old versions', async () => {
  const tags = ['1.257.0', '1.256.0', '1.255.0', '1.254.0', '2.0.0-RC6',
    'unknown', '0.1.0', '1.253.0', '1.239.12', '1.239.0', 'v0.1192.0'];
  const result = await fetchReleases(api([tags.map(tag => release(tag))]));
  assert.deepEqual(result.map(r => r.tag_name), tags.filter(t => !['unknown', '0.1.0'].includes(t)));
});

test('reads later pages even when the first page contains only excluded releases', async () => {
  const result = await fetchReleases(api([
    Array.from({ length: 100 }, () => release('0.1.0')),
    [release('1.239.12')],
  ]));
  assert.deepEqual(result.map(r => r.tag_name), ['1.239.12']);
});

test('filters empty notes and drafts while retaining meaningful prerelease notes', async () => {
  const result = await fetchReleases(api([[
    release('1.239.0', { body: '   ' }),
    release('1.239.1', { body: 'Fluxzero 1.239.1' }),
    release('1.239.2', { body: 'Flux Capacitor 1.239.2' }),
    release('1.239.3', { draft: true }),
    release('0.1192.0-RC1'), release('2.0.0-RC6'),
  ]]));
  assert.deepEqual(result.map(r => r.tag_name), ['2.0.0-RC6']);
});

test('deduplicates overlapping pages', async () => {
  const first = Array.from({ length: 100 }, (_, n) => release(`1.239.${n}`));
  const result = await fetchReleases(api([first, [first[99], release('1.238.0')]]));
  assert.equal(result.length, 101);
});

test('rejects a failed later page instead of returning truncated history', async () => {
  let calls = 0;
  const request: typeof fetch = async () => ++calls === 1
    ? Response.json(Array.from({ length: 100 }, () => release('1.239.0')))
    : new Response('rate limited', { status: 403 });
  await assert.rejects(fetchReleases(request), /GitHub API error: 403/);
});

test('refreshes edited notes and backfilled releases on subsequent fetches', async () => {
  await fetchReleases(api([[release('2.0.0-RC6')]]));
  const result = await fetchReleases(api([[
    release('2.0.0-RC6', { body: 'Updated notes' }), release('1.239.12'),
  ]]));
  assert.equal(result[0].body, 'Updated notes');
  assert.equal(result[1].tag_name, '1.239.12');
});
