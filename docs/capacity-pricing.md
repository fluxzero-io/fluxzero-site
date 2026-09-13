# Capacity pricing publication

The default `/pricing` route retains the existing offer until the release explicitly sets
`PRICING_MODEL=capacity`. For the new route set `PRICING_CATALOG_URL` to Dashboard's
public `/api/public/pricing` endpoint. The build requires an activated Starter offer, its
Pro addition, and complete monthly product prices. It fails rather than publishing invented
or partial prices. This includes builds when the catalog is unavailable.

The page, calculator and generated Markdown all use the same catalog snapshot loaded during
that build. Activate the approved Dashboard catalog and rebuild the website together. A later
catalog change requires another website build; checkout always returns a fresh, binding quote.
Do not put commercial amounts in the component or calculator. `tests/fixtures/capacity-catalog.json`
is a test fixture exported from the draft Dashboard catalog, never a production fallback.

For local integration, point the catalog URL to the running Dashboard's localhost gateway.
The website owns only the estimate. Paid activation, credits, entitlements and migrations
remain Dashboard responsibilities. The estimate includes fixed subscription, capacity, HA,
seats and volume above included storage. Identity overage, static IP and SLA are excluded
until priced and available. Full-month storage estimates use the selected month's day count;
the invoice uses actual metered volume and period.

The CTA carries the selected public plan ID to dashboard onboarding. Existing customer
contracts and high availability remain unchanged until their reviewed migration.
