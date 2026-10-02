# Capacity pricing publication

`/pricing` has one presentation: the original card styling with a wide Free
card above Starter, Pro and Enterprise. Pro lists additions to Starter; Enterprise
uses the original custom-offer content and contact CTA. The earlier `PRICING_MODEL` switch and alternative page have
been removed. Starter and Pro each flip to their own calculator; the hero, included
features and FAQ retain the original presentation.

`PRICING_CATALOG_URL` can override Dashboard's public endpoint, which defaults to
`https://api.dashboard.fluxzero.io/api/public/pricing`. The build requires activated
Starter and Pro offers and complete monthly product prices. Missing or incomplete
catalog data fails the build; test fixtures are never a production fallback.

Amounts and capacity limits in the cards and calculators share the catalog
snapshot loaded at build time. Free and Enterprise are editorial offers. Plan
feature descriptions are editorial copy, including identity
user allowances; these must be reconciled with activated entitlements before
publication. A catalog change requires a rebuild. Dashboard checkout always
returns a fresh quote. Plan links select an offer without making a purchase.

Each calculator keeps its own selections. Sizes, resource limits, included
allowances, seat prices and HA eligibility come from the catalog. Only selectable
sizes are offered; catalog-only app sizes remain unavailable. The first cluster
and first app each receive their catalog allowance once. Additional resources pay
the full catalog price. HA applies its multiplier before the first-cluster
allowance and does not include replica storage.

Storage estimates use 30 days and one allowance shared across allocated database
volumes, logs and metrics, plus measured object/backup storage. Actual invoices
use metered volume and time. Fixed subscriptions continue while capacity is
paused; unused prepaid capacity becomes credit for future purchases. The calculator does not price identity-user overage, static IP or custom SLA
agreements. The HA info control explains the size boundary, surcharge and storage.

## Verification

`pnpm test:pricing` checks estimates, discounts, seat/storage allowances, plan
limits, HA boundaries and invalid catalogs. `pnpm test:pricing-build` serves a
fixture catalog, runs the production build and checks cards, Dashboard links and
text exports. It discards fixture-derived `dist` output; deployment must run a
separate normal build. `scripts/check-pricing-build.mjs` guards the single page
presentation and the Free card and three paid columns during every production build.

The original presentation before the three-plan adaptation remains in Git at
`5f3d507`, in `LegacyPricing.astro` and `legacy-pricing.css`, for visual comparison.
