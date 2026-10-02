import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync, rmSync} from 'node:fs';
import {createServer} from 'node:http';
import {once} from 'node:events';

// Exercise the pricing page and text exports against a controlled catalog.
// The fixture artifact is discarded: only the subsequent normal build may deploy.
const fixture = readFileSync(new URL('../tests/fixtures/capacity-catalog.json', import.meta.url));
const catalog = JSON.parse(fixture);
const server = createServer((_request, response) => {
  response.writeHead(200, {'content-type': 'application/json'});
  response.end(fixture);
});
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const child = spawn('pnpm', ['build'], {
    stdio: 'inherit',
    env: {...process.env, PRICING_CATALOG_URL: `http://127.0.0.1:${server.address().port}`}
  });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0, 'Capacity pricing must pass the complete production build');
  const html = readFileSync('dist/pricing/index.html', 'utf8');
  const markdown = readFileSync('dist/llms.txt', 'utf8');
  for (const {plan, subscription} of catalog.offers) {
    assert.ok(html.includes(`?plan=${plan.planId}`), 'Each CTA must select its published Dashboard plan');
    if (!plan.details.basePlanId) {
      const storage = subscription.capabilities.find(c => c.key === 'storage.gib');
      assert.ok(markdown.includes(`${storage.included} ${storage.unit} storage included`));
    }
  }
  assert.ok(markdown.includes('Everything in Starter, plus:'), 'Pro must explain its inherited benefits');
  assert.ok(markdown.includes('allocated database volumes'), 'Text export must explain all billed storage');
  assert.ok(!html.includes('Request scale up plan'), 'Capacity pricing must not render the old offer');
  assert.equal((html.match(/data-plan-card=/g) || []).length, 2, 'Both paid plans must have a calculator');
  assert.ok(html.includes('pricing-v2-panel-current'), 'Keep the original card styling');
  console.log('Capacity pricing HTML, CTA and text-export checks passed.');
} finally {
  server.close();
  rmSync('dist', {recursive: true, force: true});
}
