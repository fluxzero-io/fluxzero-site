import test from 'node:test';
import assert from 'node:assert/strict';
import { docsDescription } from './docs-description.mjs';
test('uses prose without imports, headings or formatting', () => {
  assert.equal(docsDescription('import { Card } from "ui";\n\n# Title\n\nConfigure **your app** using [properties](/docs/).'), 'Configure your app using properties.');
});
test('does not invent missing prose and bounds long descriptions', () => {
  assert.equal(docsDescription('# Title\n\n```java\ncode\n```'), '');
  assert.ok(docsDescription('Useful prose '.repeat(30)).length <= 180);
});
