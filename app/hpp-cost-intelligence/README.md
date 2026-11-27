# HPP Cost Intelligence — Stage 1

Native Next.js client page at `/hpp-cost-intelligence` (authenticated via the existing app shell). No new packages, APIs, migrations, or environment variables.

## Local preview

1. Use the normal SIG Activa development setup and sign in.
2. Navigate directly to `/hpp-cost-intelligence`.
3. Choose **Muat snapshot JSON** and select an authorized local 2026 snapshot.
4. Test filters, threshold, reset, ranking, heatmap, drill-down, peer selection, search, sorting, pagination, CSV export, and mobile layout.

Snapshot data stays in browser memory. Reload clears it. Never commit confidential operational snapshots or place them in public assets. The JSON contract is an array of unique material/plant records with string `code`, `name`, `plant` and two 12-element arrays `c` (COGM) and `q` (delivery quantity), containing finite numbers or null; positions January–December 2026. Zero and null are distinct.

## Validation

Run from repository root using Node.js 22+:

```sh
node --experimental-strip-types --test app/hpp-cost-intelligence/model.test.mjs
npx tsc --noEmit
npm run build
```

The unit test uses synthetic data only. Before merge, run the full build and authenticated browser smoke test in the development/staging environment. Verify comparison and CSV results against the authorized snapshot; do not publish the snapshot or operational KPI values in public CI artifacts.

## Scope boundaries

- The native page reuses the existing Header and Sidebar without modifying either. Sidebar menu registration and module-specific authorization are deferred to stage 2.
- Snapshot selection is a temporary local preview, not a production data ingestion feature.
- Database history, Excel import pipeline, SAP Agent, and actual vs RKAP are later stages.
- Positive COGM values only are compared; no unverified unit conversions or cross-material aggregation.
