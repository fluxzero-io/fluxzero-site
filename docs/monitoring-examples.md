# Interactive monitoring examples

The monitoring page embeds the real Auditlog components in dark mode, with synthetic ticketing data. The demo has no authentication, production data, or backend access. All mutations live in memory and reload resets them. Each frame is independent.

Build `frontend`'s `demo` target in `fluxzero-auditlog`, then refresh this repository:

    node scripts/import-monitoring-demo.mjs

The normal website build uses the committed `public/monitoring-demo` bundle; it needs no running dashboard or sibling checkout. Do not edit the compiled bundle. The importer adds an offline CSP (`connect-src 'none'`) and adjusts the base path. Source and behavior tests live in Auditlog's `frontend/src/demo`.

Frames initialize only as they approach the viewport and share the same cacheable JS/CSS files. Unlike the former static snapshots, this version includes the Angular/ECharts runtime so real tooltips, drawers, selection and controls work. Initial payload is roughly 660 KB compressed, reused across the examples.

Audit trail and Logs support search and histogram range selection. Issues supports individual and bulk local status changes. Documents offers Reservation, Ticket and Show, with simple text search and native document details. Trace and Insights retain their real graph interactions. The parent page keeps semantic descriptions and captions for accessibility and Markdown/llms exports. Frames remain keyboard-accessible.

Before updating, check desktop and mobile, a single issue resolution, bulk resolution, fresh reset, collection changes, search with results and no results, and tooltips. Confirm there are no external connections or console errors. Changes to demo behavior belong in the Auditlog source, not a separately maintained website imitation.
