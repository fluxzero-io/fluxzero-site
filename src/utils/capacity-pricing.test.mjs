import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog, estimateCapacity, availableSizes, allowsHighAvailability, highAvailabilityLabel} from './capacity-pricing.mjs';
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/capacity-catalog.json',import.meta.url)));
const rows = (size = 'v1_starter', ha = false) => [{type:'cluster',size,ha},{type:'application',size:'v1_starter'}];

test('uses published catalog prices for Starter, Small and eligible Pro HA', () => {
  const c = validateCatalog(structuredClone(fixture));
  assert.equal(estimateCapacity(c,'starter-flex',rows(),1,20,30).total,49);
  assert.equal(estimateCapacity(c,'starter-flex',rows('v1_small'),1,20,30).total,249);
  assert.equal(estimateCapacity(c,'pro',rows('v1_medium',true),3,20,30).total,1499);
  assert.equal(estimateCapacity(c,'pro',rows('v1_medium',true),5,30,30).total,1520.44);
});

test('changes estimates when catalog configuration changes without changing calculator code', () => {
  const c = structuredClone(fixture);
  c.products.find(p => p.productId === 'cluster-v1-medium').details.price = 830;
  const result = estimateCapacity(c,'pro',rows('v1_medium',true),3,20,30);
  assert.equal(result.total,1559);
});

test('applies only one allowance and denies Starter extras, large sizes and HA', () => {
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_large'),1,20,30));
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_medium',true),1,20,30));
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

test('HA starts at the configured Medium boundary and old snapshots remain compatible', () => {
  const c = structuredClone(fixture);
  const policy = c.offers.find(o => o.plan.planId === 'pro').subscription.capacityPolicy;
  for (const size of ['v1_starter','v1_small']) {
    assert.equal(allowsHighAvailability(policy, size), false);
    assert.throws(() => estimateCapacity(c,'pro',rows(size,true),3,20,30));
  }
  assert.equal(allowsHighAvailability(policy, 'v1_medium'), true);
  assert.equal(highAvailabilityLabel(policy), 'High availability from Medium (Pro)');
  policy.highAvailabilityClusterSizes = ['v1_large'];
  assert.throws(() => estimateCapacity(c,'pro',rows('v1_medium',true),3,20,30));
  delete policy.highAvailabilityClusterSizes;
  assert.equal(estimateCapacity(c,'pro',rows('v1_small',true),3,20,30).total,699);
});
