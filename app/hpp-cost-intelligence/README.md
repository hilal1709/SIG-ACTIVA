# HPP Cost Intelligence — Stages 1–4

Native Next.js client page at `/hpp-cost-intelligence` (authenticated via the existing app shell). Uses existing PostgreSQL / Prisma connection. No new packages or environment variables.

## Local preview

1. Use the normal SIG Activa development setup and sign in.
2. Select **HPP – Cost Intelligence** in the existing sidebar (or navigate directly to `/hpp-cost-intelligence`).
3. Dashboard reads current published HPP history automatically; select a database year or **Snapshot lokal 2026** for an authorized legacy JSON preview.
4. Test filters, threshold, reset, ranking, heatmap, drill-down, peer selection, search, sorting, pagination, CSV export, and mobile layout.

Snapshot data stays in browser memory. Reload clears it. Never commit confidential operational snapshots or place them in public assets. The JSON contract is an array of unique material/plant records with string `code`, `name`, `plant` and two 12-element arrays `c` (COGM) and `q` (delivery quantity), containing finite numbers or null; positions January–December 2026. Zero and null are distinct.

## Validation

Run from repository root using Node.js 22+:

```sh
npm run test:hpp
npx tsc --noEmit
npm run build
```

The unit test uses synthetic data only. Before merge, run the full build and authenticated browser smoke test in the development/staging environment. Verify comparison and CSV results against the authorized snapshot; do not publish the snapshot or operational KPI values in public CI artifacts.

## Scope boundaries

- The page reuses the existing Header and Sidebar; HPP is registered as one top-level item beside Cost Structure. Four in-page links retain the snapshot and filter state.
- The five existing finance read roles (ADMIN_SYSTEM, STAFF_ACCOUNTING, SUPERVISOR_ACCOUNTING, AUDITOR_INTERNAL, STAFF_PRODUCTION) can view and analyze HPP, load a local preview snapshot and export the filtered CSV. Local snapshot selection is not a server write. Unknown roles are denied by signed-session middleware; the sidebar uses the same policy for display. No new role or persisted write endpoint is introduced.
- Before merge, verify each allowed role, unauthenticated direct-route redirect, unsupported-role denial, active sidebar state, mobile menu closure, and section navigation without losing the loaded snapshot. Database/API write authorization is deferred to the data stages.
- Snapshot selection is a temporary local preview, not a production data ingestion feature.
- Stage 3 adds monthly versioned history and a read-only API. Excel import/publication, SAP Agent, and actual vs RKAP remain later stages.
- Positive COGM values only are compared; no unverified unit conversions or cross-material aggregation.

## Stage 3 — database and API

- Apply migration `20261127090000_add_hpp_history` using the existing staging database migration procedure (`npx prisma migrate deploy` against an explicitly verified staging DATABASE_URL). Do not apply to production or run `prisma db push` until approved. This migration adds two tables only, with RLS enabled and no browser policies; verify the server Prisma role can access them (existing owner/bypass-RLS configuration). The partial unique current-version index and check constraints are SQL-managed.
- `HppPeriodVersion`: year, month, revision, source metadata, created-by, created/published dates and current flag. No current publication exists initially. `HppObservation`: unique material–plant within each version; source COGM and quantity in DECIMAL(38,12), optional currency, quantity unit and price unit. Null is distinct from zero; codes are text. Future ingestion must reject non-representable precision and invalid identities, never silently round or normalize. The dashboard converts decimal strings to JavaScript numbers for existing visualization only.
- One current published revision per year/month is enforced by a partial unique index. Stage 4 must insert a new immutable version and complete monthly observation set, validate coverage, then atomically deactivate the previous current revision and publish the new one within a transaction. Retain prior rows for audit; no destructive replace. A source row with both values blank can be stored explicitly to preserve coverage.
- `GET /api/hpp/history[?year=2026]` returns available published years, selected year, period/revision/publication metadata, observation count and pivoted rows. Default selects newest published year. No write route or automatic seed. Signed-session role check, private/no-store responses, repeatable-read transaction, maximum 120,000 observations / 50,000 material–plant combinations, explicit error instead of silent truncation. Empty published history is normal; missing migration/DB errors return 503 with a local preview alternative.
- Test using an isolated staging database and synthetic data: no session -> 401, unknown role -> 403, invalid year -> 400, empty database -> 200 empty, published vs unpublished/superseded versions, month uniqueness, zero/null precision, year changes, CSV year, reload and local preview. Confirm migration and rollback procedure with database owner; no production migration performed by this PR.

## Stage 4 — Excel data management

Apply the additive stage 3 migration and `20261127100000_hpp_correction_note` to an explicitly verified staging database before tests. Do not run against production without approval. Data Management is restricted to ADMIN_SYSTEM and STAFF_ACCOUNTING (signed session + current approved DB user on API). Existing readers retain dashboard/CSV access. The browser parses only Lembar1 from .xlsx, then sends validated normalized JSON (not raw file bytes). Server repeats validation and computes SHA-256 over canonical workbook content; sourceType EXCEL_NORMALIZED distinguishes this from raw binary hashes. No source workbook is stored. Limit 3 MB/1,000 material–plant combinations per import; months all blank cannot publish. Numeric source values are accepted only if representable in DECIMAL(38,12) without rounding. Excel's native binary floating-point representation is converted via JS shortest decimal string. No unit conversion, no guessed units. Preview displays per-month coverage, current revision and differences; correction requires explicit confirmation and reason. Missing prior combinations or previously verified unit metadata block replacement. Same content is skipped. API rechecks version IDs and content hash, then atomically publishes selected months using serializable transaction; previous versions retained. History is limited to newest 500 records in selected year with explicit truncation. No delete or rollback endpoint. Stage 5 Agent not implemented.

Staging acceptance: test authorized and forbidden roles, wrong/malformed file, duplicate identities, zero vs null, blank month, initial publish, repeat upload no-op, changed values with reason, omitted key refusal, stale preview/concurrent request, all-or-nothing transaction, history and dashboard refresh. Verify actual source data only in approved staging; never commit source workbook or confidential JSON.

## HPP UX alignment

HPP Dashboard and Data Management now follow the existing Activa Dashboard motion language (GSAP section reveal, animated integer KPIs, colored metric icons, hover states, shared Card/Skeleton, top loading bar and Sonner feedback). Animations are scoped to HPP, cleaned up on unmount and reduced-motion aware. Retains responsive filter grid, KPI auto-fit and manual register resize. No database/API/model changes. Browser acceptance: first load skeleton, refresh with existing data, empty/error states, filter changes, drill-down, resize/autofit, upload preview, publish feedback and mobile/reduced-motion behavior.

## Stage 5 — SAP Desktop Agent pilot

See scripts/desktop-agent/README.md. Generic device registration and a versioned machine protocol; HPP is the first job handler. New device registration/revocation, scoped job queue, machine-only bearer endpoint, result staging and human review. Synthetic mode cannot publish; SAP publication additionally defaults off. Migration is additive and must be applied through approved Supabase tooling, not the historical Prisma chain. No direct SAP posting. Real SAP GUI adapter and end-to-end Windows validation are pending.
