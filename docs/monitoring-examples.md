# Monitoring examples

Component source: `fluxzero-auditlog` commit `5806ad8`.

Generated HTML/SVG from the real Fluxzero Auditlog components with synthetic ticketing data. No production data, credentials, Angular runtime, or external requests are included. The marketing page supplies accessible descriptions; frames are visual illustrations with nonfunctional controls removed.

To refresh, use the `frontend/src/demo` instructions in `fluxzero-auditlog`, then run:

    node scripts/import-monitoring-examples.mjs ../fluxzero-auditlog/frontend/dist/monitoring-snapshots

The normal website build uses the committed exports and needs no sibling repository or running dashboard. Do not hand-edit the generated HTML. Review desktop and mobile after refreshing. The trace retains a horizontally scrollable timeline on narrow screens; tables use the dashboard's native mobile cards. Mobile Insights focuses on Payments. Documents shows the selected reservation detail. Sticky table masks and headers are disabled in static exports so rows remain visible without the dashboard shell.
