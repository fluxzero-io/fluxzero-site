import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('dist/client/pricing/index.html', 'utf8');
const markdown = readFileSync('dist/client/llms.txt', 'utf8');
assert.ok(html.includes('id="capacity-catalog"'), 'Pricing must use the published capacity catalog');
assert.equal((html.match(/data-plan-card=/g) || []).length, 2, 'Starter and Pro each need their own calculator');
assert.ok(html.includes('pricing-v2-panel-current'), 'Use the original pricing presentation');
assert.ok(!html.includes('capacity-offer'), 'The discarded pricing presentation must not be included');
for (const name of ['Free', 'Starter', 'Pro', 'Enterprise']) assert.ok(html.includes(`<h2>${name}</h2>`), `Missing ${name} plan`);
for (const name of ['Builder', 'Startup', 'Scale Up']) assert.ok(!html.includes(`<h2>${name}</h2>`), `Retired ${name} plan`);
assert.ok(html.indexOf('<h2>Free</h2>') < html.indexOf('pricing-v2-panel-current"'), 'Free must precede the paid plan grid');
const catalogMatch = html.match(/<script type="application\/json" id="capacity-catalog">([\s\S]*?)<\/script>/);
assert.ok(catalogMatch, 'The complete published pricing catalog must be embedded in the page');
const catalog = JSON.parse(catalogMatch[1]);
for (const {plan, subscription} of catalog.offers) {
  assert.ok(html.includes(`?plan=${plan.planId}`), 'Each CTA must select its published Dashboard plan');
  if (!plan.details.basePlanId) {
    const storage = subscription.capabilities.find(capability => capability.key === 'storage.gib');
    assert.ok(markdown.includes(`${storage.included} ${storage.unit} storage included`));
  }
}
assert.ok(markdown.includes('Everything in Starter, plus:'), 'Pro must explain its inherited benefits');
assert.ok(markdown.includes('allocated database volumes'), 'Text export must explain all billed storage');
assert.ok(!html.includes('Request scale up plan'), 'Capacity pricing must not render the old offer');
console.log('Free entry, three paid plans, published catalog and text exports verified.');
