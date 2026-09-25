import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const html = readFileSync('dist/pricing/index.html', 'utf8');
const capacity = (process.env.PRICING_MODEL || 'legacy') === 'capacity';
assert.equal(html.includes('id="capacity-catalog"'), capacity, 'Built pricing must match the release model');
assert.ok(!html.includes(capacity ? '.pricing-v2-card' : '.capacity-offer'),
  'The inactive pricing variant must not contribute page styles');
console.log(`Pricing model and isolated ${capacity ? 'capacity' : 'legacy'} styles verified.`);
