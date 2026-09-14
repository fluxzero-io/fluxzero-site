import test from 'node:test';
import assert from 'node:assert/strict';
import { paginateReleases, releaseAnchor, changelogAnchorPages, changelogPageUrl } from './changelog-pagination.mjs';

const release = (n) => ({ version: `1.0.${n}`, date: '2026-09-14' });

test('partition sorted history without dropping or duplicating boundary releases', () => {
  for (const count of [0, 1, 20, 21, 40, 41]) {
    const input = Array.from({ length: count }, (_, n) => release(n));
    const pages = paginateReleases(input);
    assert.equal(pages.length, Math.ceil(count / 20));
    assert.ok(pages.every(page => page.length > 0 && page.length <= 20));
    assert.deepEqual(pages.flat().map(r => r.version), [...input].reverse().map(r => r.version));
    assert.deepEqual(input.map(r => r.version), Array.from({ length: count }, (_, n) => `1.0.${n}`));
  }
});

test('publication date takes precedence over version and prereleases remain intact', () => {
  const pages = paginateReleases([
    { version: '2.0.0-RC9', date: '2026-09-12T12:00:00Z' },
    { version: '2.0.0-RC10', date: '2026-09-12T11:00:00Z' },
    { version: '1.275.0', date: '2026-09-14' },
  ]);
  assert.deepEqual(pages[0].map(r => r.version), ['1.275.0', '2.0.0-RC9', '2.0.0-RC10']);
});

test('legacy fragments resolve to the new page after newer releases shift the boundary', () => {
  const input = Array.from({ length: 21 }, (_, n) => release(n));
  const anchor = releaseAnchor(release(1));
  assert.equal(anchor, 'sep-14-2026--101');
  assert.equal(changelogAnchorPages(paginateReleases(input))[anchor], 1);
  assert.equal(changelogAnchorPages(paginateReleases([...input, release(21)]))[anchor], 2);
  assert.equal(changelogAnchorPages(paginateReleases(input))['2026'], 1);
  assert.equal(releaseAnchor({ version: '2.0.0-rc.12', date: '2026-09-14' }), 'sep-14-2026--200-rc12');
  assert.equal(changelogPageUrl(1), '/docs/changelog/');
  assert.equal(changelogPageUrl(2), '/docs/changelog/page/2/');
});
