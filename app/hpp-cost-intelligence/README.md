# HPP Cost Intelligence — Stages 1–2

Native Next.js client page at `/hpp-cost-intelligence` (authenticated via the existing app shell). No new packages, APIs, migrations, or environment variables.

## Local preview

1. Use the normal SIG Activa development setup and sign in.
2. Select **HPP – Cost Intelligence** in the existing sidebar (or navigate directly to `/hpp-cost-intelligence`).
3. Choose **Muat snapshot JSON** and select an authorized local 2026 snapshot.
4. Test filters, threshold, reset, ranking, heatmap, drill-down, peer selection, search, sorting, pagination, CSV export, and mobile layout.

Snapshot data stays in browser memory. Reload clears it. Never commit confidential operational snapshots or place them in public assets. The JSON contract is an array of unique material/plant records with string `code`, `name`, `plant` and two 12-element arrays `c` (COGM) and `q` (delivery quantity), containing finite numbers or null; positions January–December 2026. Zero and null are distinct.

## Validation

Run from repository root using Node.js 22+:

```sh
node --experimental-strip-types --test app/hpp-cost-intelligence/model.test.mjs lib/hpp/access.test.mjs
npx tsc --noEmit
npm run build
```

The unit test uses synthetic data only. Before merge, run the full build and authenticated browser smoke test in the development/staging environment. Verify comparison and CSV results against the authorized snapshot; do not publish the snapshot or operational KPI values in public CI artifacts.

## Scope boundaries

- The page reuses the existing Header and Sidebar; HPP is registered as one top-level item beside Cost Structure. Four in-page links retain the snapshot and filter state.
- The five existing finance read roles (ADMIN_SYSTEM, STAFF_ACCOUNTING, SUPERVISOR_ACCOUNTING, AUDITOR_INTERNAL, STAFF_PRODUCTION) can view and analyze HPP, load a local preview snapshot and export the filtered CSV. Local snapshot selection is not a server write. Unknown roles are denied by signed-session middleware; the sidebar uses the same policy for display. No new role or persisted write endpoint is introduced.
- Before merge, verify each allowed role, unauthenticated direct-route redirect, unsupported-role denial, active sidebar state, mobile menu closure, and section navigation without losing the loaded snapshot. Database/API write authorization is deferred to the data stages.
- Snapshot selection is a temporary local preview, not a production data ingestion feature.
- Database history, Excel import pipeline, SAP Agent, and actual vs RKAP are later stages.
- Positive COGM values only are compared; no unverified unit conversions or cross-material aggregation.
