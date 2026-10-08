import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createJavadocPreviewLoader, javadocPath } from './javadoc-preview';

const base = 'https://fluxzero-io.github.io/fluxzero-sdk-java/javadoc/apidocs/';
const nested = 'io.fluxzero.sdk.configuration.client.WebSocketClient.ClientConfig';
const path = 'io/fluxzero/sdk/configuration/client/WebSocketClient.ClientConfig';

test('preserves the indexed package boundary for ordinary and nested types', () => {
  assert.equal(javadocPath(base + path + '.html'), path);
  assert.equal(javadocPath(base + 'io/fluxzero/common/Guarantee.html'), 'io/fluxzero/common/Guarantee');
  assert.equal(javadocPath(base + 'io/UPPER/lower.nested.html'), 'io/UPPER/lower.nested');
});

test('loads nested source and binary names and ordinary classes through one shared index', async () => {
  const requests: string[] = [];
  const load = createJavadocPreviewLoader(async (input) => {
    const url = String(input);
    requests.push(url);
    if (url === '/javadoc-index.json') return Response.json({
      [nested]: path, 'io.fluxzero.common.Guarantee': 'io/fluxzero/common/Guarantee',
    });
    return Response.json({ documentation: url.endsWith(path + '.json') ? 'Client configuration' : 'Guarantees' });
  });
  assert.deepEqual(await Promise.all([load(nested), load(nested.replace('.ClientConfig', '$ClientConfig'))]),
    ['Client configuration', 'Client configuration']);
  assert.equal(await load('io.fluxzero.common.Guarantee'), 'Guarantees');
  assert.equal(requests.filter((url) => url === '/javadoc-index.json').length, 1);
  assert.equal(requests.filter((url) => url.endsWith('/' + path + '.json')).length, 2);
  await assert.rejects(load('toString'), /not indexed/);
  assert.equal(requests.length, 4);
});

test('retries a failed index request and distinguishes missing documentation from failed requests', async () => {
  let attempts = 0;
  let failPreview = false;
  const load = createJavadocPreviewLoader(async (input) => {
    if (String(input) === '/javadoc-index.json') {
      if (++attempts === 1) return new Response(null, { status: 503 });
      return Response.json({ [nested]: path });
    }
    return failPreview ? new Response(null, { status: 404 }) : Response.json({ documentation: null });
  });
  await assert.rejects(load(nested), /index: HTTP 503/);
  assert.equal(await load(nested), null);
  failPreview = true;
  await assert.rejects(load(nested), /preview: HTTP 404/);
  assert.equal(attempts, 2);
});
