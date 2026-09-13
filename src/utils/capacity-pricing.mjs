/** Public estimates use the same published product and plan snapshots as Dashboard checkout. */
export async function loadPricingCatalog(url) {
  if (!url) throw new Error('Capacity pricing requires PRICING_CATALOG_URL');
  const response = await fetch(url, {signal: AbortSignal.timeout(15000)});
  if (!response.ok) throw new Error(`Pricing catalog unavailable (${response.status})`);
  return validateCatalog(await response.json());
}

export function validateCatalog(catalog) {
  const offers = catalog?.offers;
  if (!Array.isArray(offers) || offers.length !== 2 || !Array.isArray(catalog.products)) {
    throw new Error('Publish exactly one Starter offer and one Pro addition before releasing capacity pricing');
  }
  const starter = offers.find(o => !o.plan.details.basePlanId);
  const pro = offers.find(o => o.plan.details.basePlanId === starter?.plan.planId);
  if (!starter || !pro) throw new Error('The Pro addition must reference the published Starter offer');
  for (const offer of offers) {
    const s = offer.subscription;
    if (!offer.plan.activated || !s?.capacityPolicy || s.interval !== 'monthly'
        || !s.version || s.currency !== starter.subscription.currency || !Number.isFinite(Number(s.amount))) {
      throw new Error('Pricing requires activated monthly offers with a version and a shared currency');
    }
    const own = offer.plan.details.prices.find(p => p.interval === 'monthly');
    if (!own || Number(own.amount) < 0 || own.currency !== s.currency
        || Math.abs(Number(s.amount) - Number(own.amount) - Number(s.basePlan?.amount || 0)) > .001) {
      throw new Error('Published plan totals do not match their price components');
    }
    for (const [type, sizes] of [['cluster', s.capacityPolicy.clusterSizes], ['application', s.capacityPolicy.applicationSizes]]) {
      for (const size of sizes) productFor(catalog, type, size);
      const included = capability(s, `${type}.`, true);
      if (!included?.productId || !catalog.products.some(p => p.productId === included.productId)) {
        throw new Error('Included capacity must reference a published catalog product');
      }
    }
  }
  return catalog;
}

export function capability(plan, key, prefix = false) {
  return plan.capabilities.find(c => prefix ? c.key.startsWith(key) && c.key.endsWith('.count') && Number(c.included) > 0 : c.key === key);
}

export function productFor(catalog, type, size) {
  const matches = catalog.products.filter(p => p.details.resourceType === type && p.details.size === size
    && p.details.billingUnit === 'billing_period');
  if (matches.length !== 1 || Number(matches[0].details.price) < 0) throw new Error('A unique monthly capacity price is required');
  return matches[0];
}

export function availableSizes(catalog, plan, type) {
  return [...(type === 'cluster' ? plan.capacityPolicy.clusterSizes : plan.capacityPolicy.applicationSizes)]
    .sort((a, b) => Number(productFor(catalog,type,a).details.price) - Number(productFor(catalog,type,b).details.price));
}

export function estimateCapacity(catalog, planId, rows, seats, storage, days) {
  const offer = catalog.offers.find(o => o.plan.planId === planId);
  if (!offer) throw new Error('Unknown plan');
  const plan = offer.subscription;
  const policy = plan.capacityPolicy;
  const seen = {cluster: 0, application: 0};
  const lines = rows.map(row => {
    const allowed = row.type === 'cluster' ? policy.clusterSizes : policy.applicationSizes;
    if (!allowed.includes(row.size)) throw new Error('This size requires a different plan');
    const count = ++seen[row.type];
    const maximum = row.type === 'cluster' ? policy.maximumClusters : policy.maximumApplications;
    if (maximum != null && count > maximum) throw new Error('Additional capacity requires Pro');
    if (row.ha && (row.type !== 'cluster' || !policy.highAvailability)) throw new Error('High availability requires Pro');
    const product = productFor(catalog, row.type, row.size);
    const catalogAmount = Number(product.details.price);
    const included = capability(plan, `${row.type}.`, true);
    const discount = count === 1 ? Number(catalog.products.find(p => p.productId === included.productId).details.price) : 0;
    const haAmount = row.ha ? catalogAmount * (Number(policy.highAvailabilityPriceMultiplier) - 1) : 0;
    if (!Number.isFinite(haAmount) || haAmount < 0) throw new Error('HA pricing is not published');
    return {label: product.details.description, amount: Math.max(0, catalogAmount - discount) + haAmount, haAmount, discount};
  });
  if (![seats, storage, days].every(v => Number.isFinite(v) && v >= 0) || !Number.isInteger(seats) || days < 1 || days > 31) {
    throw new Error('Enter valid seat, storage and billing-month values');
  }
  const seatAllowance = capability(plan, 'seats.count');
  const extraSeats = Math.max(0, seats - Number(seatAllowance.included));
  if (extraSeats && seatAllowance.unitPrice == null) throw new Error('Extra seat pricing is not published');
  const seatAmount = extraSeats * Number(seatAllowance.unitPrice || 0);
  const storageAllowance = capability(plan, 'storage.gib');
  const storageProduct = catalog.products.find(p => p.productId === storageAllowance.productId);
  if (!storageProduct) throw new Error('Storage pricing is not published');
  const storageAmount = Math.max(0, storage - Number(storageAllowance.included)) * days * Number(storageProduct.details.price);
  const fixed = Number(plan.amount);
  const capacity = lines.reduce((sum, l) => sum + l.amount, 0);
  return {lines, fixed, capacity, seatAmount, storageAmount, total: fixed + capacity + seatAmount + storageAmount};
}

export function offerFeatures(offer) {
  const p = offer.subscription, policy = p.capacityPolicy;
  const storage = capability(p, 'storage.gib'), seats = capability(p, 'seats.count');
  const domains = capability(p, 'domains.custom.count'), users = capability(p, 'identity.users');
  const features = [
    'First Starter cluster and Starter app included',
    `${storage.included} ${storage.unit} storage included; extra volume billed afterwards`,
    `${seats.included} ${Number(seats.included) === 1 ? 'seat' : 'seats'} included; add more as you grow`,
    domains.maximum == null && !domains.hardLimit ? 'Unlimited custom domains' : `${domains.maximum ?? domains.included} custom domain`,
    policy.maximumClusters == null ? 'Purchase additional clusters and apps; larger sizes available' : 'One cluster and one app; upgrade either up to Medium',
    policy.ticketSupport ? 'Ticket support' : 'Community support'
  ];
  if (policy.highAvailability) features.push('High availability available as a paid option');
  if (policy.backups) features.push('Manual and automated backups; storage usage applies');
  if (policy.pointInTimeRecoveryDays) features.push(`Point-in-time recovery over the last ${policy.pointInTimeRecoveryDays} days`);
  if (users) features.push(`${Number(users.included).toLocaleString('en-GB')} identity users included${policy.identityUsers ? '' : ' when available'}`);
  if (offer.plan.details.basePlanId) features.push('Static IP, additional identity-user pricing and SLA: to be announced');
  return features;
}
