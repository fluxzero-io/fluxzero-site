import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import remarkDocsLinks from './remark-docs-links.mjs';

test('publishes source links and references by slug, preserving fragments and queries', async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'docs-links-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  await mkdir(path.join(dir, 'nested'));
  await writeFile(path.join(dir, '085-example.mdx'), '---\r\nslug: "docs/guides/example" # canonical\r\n---\r\nContent');
  const file = { path: path.join(dir, 'nested', 'source.mdx'), fail: (message) => { throw new Error(message); } };
  const children = [
    { type: 'link', url: '../085-example.mdx#details' },
    { type: 'definition', url: '../085-example.mdx?mode=full#details' },
    { type: 'link', url: 'https://example.com/example.mdx' },
    { type: 'link', url: '/docs/absolute/' },
    { type: 'image', url: './figure.svg' },
    { type: 'code', value: '[example](../085-example.mdx)' },
  ];
  await remarkDocsLinks()({ type: 'root', children }, file);
  assert.equal(children[0].url, '/docs/guides/example/#details');
  assert.equal(children[1].url, '/docs/guides/example/?mode=full#details');
  assert.equal(children[2].url, 'https://example.com/example.mdx');
  assert.equal(children[3].url, '/docs/absolute/');
  assert.equal(children[4].url, './figure.svg');
  assert.equal(children[5].value, '[example](../085-example.mdx)');
  await assert.rejects(remarkDocsLinks()({ type: 'link', url: './missing.mdx' }, file), /does not exist/);
  await writeFile(path.join(dir, 'nested', 'no-slug.md'), '# No slug');
  await assert.rejects(remarkDocsLinks()({ type: 'link', url: './no-slug.md' }, file), /published slug/);
});
