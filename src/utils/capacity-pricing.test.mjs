import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateCatalog, estimateCapacity, availableSizes, allowsHighAvailability, highAvailabilityLabel, isPurchasable} from './capacity-pricing.mjs';
const fixture = JSON.parse(readFileSync(new URL('../../tests/fixtures/capacity-catalog.json',import.meta.url)));
const rows = (size = 'v1_starter', ha = false) => [{type:'cluster',size,ha},{type:'application',size:'v1_starter'}];

test('uses published catalog prices for Starter, Small and eligible Pro HA', () => {
  const c = validateCatalog(structuredClone(fixture));
  assert.equal(estimateCapacity(c,'starter-flex',rows(),1,50,30).total,49);
  assert.equal(estimateCapacity(c,'starter-flex',rows('v1_small'),1,50,30).total,199);
  assert.equal(estimateCapacity(c,'pro',rows('v1_medium',true),3,50,30).total,849);
  assert.equal(estimateCapacity(c,'pro',rows('v1_medium',true),5,60,30).total,870.44);
});

test('changes estimates when catalog configuration changes without changing calculator code', () => {
  const c = structuredClone(fixture);
  c.products.find(p => p.productId === 'capacity-v1-cluster-v1-medium').details.price = 830;
  const result = estimateCapacity(c,'pro',rows('v1_medium',true),3,50,30);
  assert.equal(result.total,1194);
});

test('applies only one allowance and denies Starter extras, large sizes and HA', () => {
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_large'),1,50,30));
  assert.throws(() => estimateCapacity(fixture,'starter-flex',rows('v1_medium',true),1,50,30));
  assert.throws(() => estimateCapacity(fixture,'starter-flex',[...rows(),rows()[0]],1,50,30));
  assert.equal(estimateCapacity(fixture,'pro',[...rows(),rows()[0]],3,50,30).total,249);
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
    assert.throws(() => estimateCapacity(c,'pro',rows(size,true),3,50,30));
  }
  assert.equal(allowsHighAvailability(policy, 'v1_medium'), true);
  assert.equal(highAvailabilityLabel(policy), 'High availability from Medium (Pro)');
  policy.highAvailabilityClusterSizes = ['v1_large'];
  assert.throws(() => estimateCapacity(c,'pro',rows('v1_medium',true),3,50,30));
  delete policy.highAvailabilityClusterSizes;
  assert.equal(estimateCapacity(c,'pro',rows('v1_small',true),3,50,30).total,399);
});


test('shares the 50 GiB allowance across storage and charges additional seats once', () => {
  assert.equal(estimateCapacity(fixture,'starter-flex',rows(),3,50,31).total,69);
  assert.equal(estimateCapacity(fixture,'starter-flex',rows(),3,100,31).total,76.44);
  assert.equal(estimateCapacity(fixture,'pro',[...rows('v1_medium',true), {type:'cluster',size:'v1_medium',ha:true}],3,50,30).total,1749);
});

test('keeps all twelve catalog prices without offering unsupported resource sizes', () => {
  for (const type of ['cluster','application']) {
    const products = fixture.products.filter(p => p.details.resourceType === type);
    assert.equal(products.length,12);
    assert.equal(isPurchasable(fixture, products.find(p => p.details.size === 'v1_3xl')),false);
    assert.equal(isPurchasable(fixture, products.find(p => p.details.size === 'v1_medium')),true);
  }
});

test('rejects missing, non-finite and ambiguous prices instead of displaying a free resource', () => {
  for (const price of [null, undefined, '', 'NaN', 'Infinity', -1]) {
    const c = structuredClone(fixture);
    c.products.find(p => p.details.size === 'v1_small').details.price = price;
    assert.throws(() => validateCatalog(c));
  }
  const c = structuredClone(fixture);
  c.products.push(structuredClone(c.products[0]));
  assert.throws(() => validateCatalog(c));
});

test('rejects incomplete storage, seat and HA publication', () => {
  for (const change of [
    c => c.products.find(p => p.details.size === 'v1_3xl').details.price = 'NaN',
    c => c.products.find(p => p.details.resourceType === 'database_storage').details.price = null,
    c => c.offers[0].subscription.capabilities.find(p => p.key === 'seats.count').unitPrice = null,
    c => c.offers[1].subscription.capacityPolicy.highAvailabilityPriceMultiplier = null,
    c => c.offers[1].subscription.capacityPolicy.highAvailabilityClusterSizes = ['v1_3xl']
  ]) {
    const c = structuredClone(fixture); change(c); assert.throws(() => validateCatalog(c));
  }
});
