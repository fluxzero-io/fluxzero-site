import test from 'node:test';
import assert from 'node:assert/strict';
import { renderChangelogBody } from '../utils/changelog-body.mjs';

test('release notes retain working forward links to their own headings', () => {
  const body = '[upgrade](#compatibility-and-upgrading)\n\n#### Compatibility and upgrading';
  const html = renderChangelogBody(body, '2.0.0');
  assert.match(html, /href="#release-2\.0\.0-compatibility-and-upgrading"/);
  assert.match(html, /<h4 id="release-2\.0\.0-compatibility-and-upgrading">/);
  assert.notEqual(html, renderChangelogBody(body, '2.0.0-rc.20'));
});

test('repeated, formatted and Unicode headings follow GitHub fragment naming', () => {
  const html = renderChangelogBody(
    '[second](#details-1) [unicode](#caf%C3%A9--model)\n\n'
    + '#### Details\n\n#### Details\n\n#### Café &amp; `Model`', '2.0.0');
  assert.match(html, /href="#release-2\.0\.0-details-1"/);
  assert.match(html, /id="release-2\.0\.0-details-1"/);
  assert.match(html, /href="#release-2\.0\.0-café--model"/);
  assert.match(html, /id="release-2\.0\.0-café--model"/);
});

test('preserve code, external links, explicit heading IDs and unresolved links', () => {
  const html = renderChangelogBody(
    '[external](https://example.com/#details) [missing](#missing) [custom](#custom)\n\n'
    + '<h4 id="custom">Custom</h4>\n\n'
    + '```java\n// #details\n```\n\n<details open><summary>Commit</summary><p>Body</p></details>', '2.0.0');
  assert.match(html, /href="https:\/\/example.com\/#details"/);
  assert.match(html, /href="#missing"/);
  assert.match(html, /href="#release-2\.0\.0-custom"/);
  assert.match(html, /id="release-2\.0\.0-custom"/);
  assert.match(html, /<code class="language-java">\/\/ #details\n<\/code>/);
  assert.match(html, /<details open=""><summary>Commit<\/summary><p>Body<\/p><\/details>/);
});
