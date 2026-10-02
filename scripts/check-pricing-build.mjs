import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('dist/pricing/index.html', 'utf8');
assert.ok(html.includes('id="capacity-catalog"'), 'Pricing must use the published capacity catalog');
assert.equal((html.match(/data-plan-card=/g) || []).length, 2, 'Starter and Pro each need their own calculator');
assert.ok(html.includes('pricing-v2-panel-current'), 'Use the original pricing presentation');
assert.ok(!html.includes('capacity-offer'), 'The discarded pricing presentation must not be included');
for (const name of ['Free', 'Starter', 'Pro']) assert.ok(html.includes(`<h2>${name}</h2>`), `Missing ${name} plan`);
for (const name of ['Builder', 'Startup', 'Scale Up', 'Enterprise']) assert.ok(!html.includes(`<h2>${name}</h2>`), `Retired ${name} plan`);
console.log('Three-plan pricing and catalog-backed calculators verified.');
