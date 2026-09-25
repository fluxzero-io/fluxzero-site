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
is derived from Dashboard's `capacity-plans.json` and `capacity-products.json` at main `e24cbd22`,
with activation and subscription snapshots simulated for tests. It uses the 50-GiB allowance,
the €150 Starter catalog value and the 1.5 HA multiplier. It is never a production fallback.
All twelve catalog prices are retained; only sizes allowed by a published plan are selectable.
A price without a selectable size is explicitly marked as not yet available. Final release
qualification must still establish the infrastructure mapping for every offered size.

For local integration, point the catalog URL to the running Dashboard's localhost gateway.
The website owns only the estimate. Paid activation, credits, entitlements and migrations
remain Dashboard responsibilities. The estimate includes fixed subscription, capacity, HA,
seats and volume above included storage. Identity overage, static IP and SLA are excluded
until priced and available. Full-month storage estimates use the selected month's day count;
the invoice uses actual metered volume and period.

The CTA carries the selected public plan ID to dashboard onboarding. Existing customer
contracts and high availability remain unchanged until their reviewed migration.

## Verification and activation

`pnpm test:pricing` checks estimates, included-resource discounts, one shared storage allowance,
HA eligibility and incomplete catalog rejection. `pnpm test:pricing-build` serves the local test
catalog, runs the complete build and checks HTML, Dashboard links and text exports. It deletes
its fixture-derived `dist` output afterwards. CI then runs a separate normal build for deployment.

The release workflow reads the repository variables `PRICING_MODEL` (default `legacy`) and
`PRICING_CATALOG_URL`. After the Dashboard activation gates are satisfied, set the latter to
the public pricing endpoint, set the model to `capacity`, and dispatch the normal workflow
on main. A missing, inactive, incomplete or non-finite catalog fails the build. A misspelled
model also fails instead of silently publishing the old offer. Roll back public advertising
by returning the model to `legacy` and rebuilding main; this never changes customer contracts.

Storage estimates include allocated database/replica, log and metric volumes plus measured
object/backup storage. The allowance applies once per organisation, independently of the HA
surcharge. System disks are not additional customer data storage.
