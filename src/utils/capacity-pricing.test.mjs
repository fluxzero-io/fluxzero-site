import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog, estimateCapacity, availableSizes} from './capacity-pricing.mjs';
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/capacity-catalog.json',import.meta.url)));
const rows = (size = 'v1_starter', ha = false) => [{type:'cluster',size,ha},{type:'application',size:'v1_starter'}];

test('matches the agreed Starter, Small and Pro HA examples from the Dashboard catalog', () => {
  const c = validateCatalog(structuredClone(fixture));
  assert.equal(estimateCapacity(c,'starter-flex',rows(),1,20,30).total,49);
  assert.equal(estimateCapacity(c,'starter-flex',rows('v1_small'),1,20,30).total,249);
  assert.equal(estimateCapacity(c,'pro',rows('v1_small',true),3,20,30).total,699);
  assert.equal(estimateCapacity(c,'pro',rows('v1_small',true),5,30,30).total,720.44);
});

test('changes estimates when catalog configuration changes without changing calculator code', () => {
  const c = structuredClone(fixture);
  c.products.find(p => p.productId === 'cluster-v1-small').details.price = 430;
  const result = estimateCapacity(c,'pro',rows('v1_small',true),3,20,30);
  assert.equal(result.total,759);
});

test('applies only one allowance and denies Starter extras, large sizes and HA', () => {
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_large'),1,20,30));
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_small',true),1,20,30));
  assert.throws(() => estimateCapacity(fixture,'starter-flex',[...rows(),rows()[0]],1,20,30));
  assert.equal(estimateCapacity(fixture,'pro',[...rows(),rows()[0]],3,20,30).total,299);
});

test('refuses incomplete or inactive releases and sorts unordered size sets by catalog price', () => {
  const c = structuredClone(fixture);
  c.offers[0].plan.activated = false;
  assert.throws(() => validateCatalog(c));
  assert.equal(availableSizes(fixture,fixture.offers[0].subscription,'cluster')[0],'v1_starter');
  assert.throws(() => validateCatalog({...fixture, products: []}));
});
