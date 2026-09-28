# Phase I — Materiality, Commentary, and Review

## Scope and schema

Phase I adds `CostMaterialityRule`, `CostCommentary`, append-only `CostCommentaryHistory`, and one `CostPeriodReview` per Cost Period. It is an overlay on Engine 2 V2 and never persists or changes analytical/accounting amounts. Thresholds are PostgreSQL numeric (`20,2` amount and `20,6` percentage points); no default business threshold is seeded.

## Engine 2 V2 integration

Engine 2 hierarchy is:

```text
Company
→ Analysis Basis
→ Cost Group
→ Nature
→ COA / Calculated Item
```

Company 2000 has one `SI` basis. Company 7000 has separate additive `GHOPO` and `DERIV` bases. Analysis Basis is analytical source context only: it is not a Cost Group, is not a materiality-rule scope, never requires commentary, and is always `NOT_APPLICABLE` for materiality.

Commentary is allowed only at `COST_GROUP`, `NATURE`, `COA`, and `CALCULATED_ITEM`. Stable commentary identity uses the exact basis-qualified Engine 2 key, e.g. `basis:GHOPO:group:<id>:nature:<id>` or `basis:DERIV:...`; therefore the same stable Cost Group/Nature IDs under GHOPO and DERIV remain distinct.

## Materiality

Rules are resolved at the current period's `periodEnd`, first by Company + Cost Group + comparison, then by Company-wide + comparison. Resolution never crosses Company/comparison and multiple rules at one specificity are integrity errors. Exact-scope active intervals may not overlap. A successor is created after end-dating its predecessor rather than rewriting history.

Magnitude uses absolute variance. Threshold equality passes. `OR` requires any PASS; without PASS an unevaluable configured criterion yields `NOT_EVALUABLE`. `AND` returns NORMAL on any FAIL, otherwise `NOT_EVALUABLE` when needed, otherwise requires explanation. An N/M percentage is unevaluable, never zero. Missing rules are `NOT_CONFIGURED`, unavailable comparisons are `UNAVAILABLE`, and Company/Analysis Basis nodes are `NOT_APPLICABLE`.

## Commentary identity, lineage, and workflow

A SHA-256 digest binds commentary to the exact comparison lineage. The canonical lineage includes `periodId`, fiscal year/period, active `runId`, `ruleSetVersion`, `uploadId`, and `basisCode`, plus comparison type. Ordering is deterministic across periods and bases.

Company 2000 requires exactly one SI lineage entry per month. Company 7000 requires exactly two entries per month for the same finalized active run/upload: GHOPO and DERIV. Basis records are never deduplicated merely because they share a period/run.

Persisted workflow is `DRAFT -> SUBMITTED -> REVIEWED` or `DRAFT -> SUBMITTED -> RETURNED -> DRAFT`. Submit requires a reason; return requires a reviewer note. Reviewed rows are immutable. Maker/checker prohibits a preparer from reviewing or returning their own commentary. Every save/transition atomically updates commentary, appends a monotonic history version, and writes `CostAuditLog`.

Every draft and transition revalidates all lineage periods inside the same SERIALIZABLE transaction: FINALIZED status, active run identity, SUCCESS/active flags, fiscal month, rule-set version, upload ID, and required SI or GHOPO+DERIV basis set must still match.

## Period review and authorization

Review completion requires a FINALIZED period, at least one AVAILABLE comparison, configured/evaluable materiality for every applicable analytical row, and REVIEWED current-lineage commentary for every row that requires explanation. Unavailable comparisons do not block; all comparisons unavailable does block. Company and Analysis Basis rows never block review.

Commit-time review revalidates lineage, materiality rules, and reviewed commentary under a SERIALIZABLE transaction. Traversal preserves Cost Group context per Analysis Basis branch so GHOPO and DERIV cannot leak scope into one another.

Read uses existing finance read roles; draft/submit uses ADMIN_SYSTEM or STAFF_ACCOUNTING; return/review/complete uses ADMIN_SYSTEM or SUPERVISOR_ACCOUNTING; rule administration is ADMIN_SYSTEM only.

## APIs and UI

Read materiality at `GET /api/cost-fluctuation/materiality`. Rule administration is under `/api/cost-fluctuation/materiality-rules`. Commentary overlay/draft/submit/return/review routes are under `/api/cost-fluctuation/commentary`; review readiness/completion is under `/api/cost-fluctuation/review`. `/cost-fluctuation` displays the workflow overlay, while `/cost-fluctuation/materiality-rules` provides the admin configuration form.

## Migration and validation

The additive migration is `prisma/migrations/20260831120000_phase_i_materiality_commentary_review/migration.sql`. It creates only Phase I enums, tables, indexes, target/check constraints, and foreign keys. It must be reviewed and applied through controlled Supabase tooling; it is not applied by application startup or Prisma production commands.

Tests cover materiality threshold/effective-date semantics, basis-qualified lineage determinism, GHOPO+DERIV lineage validation, maker/checker, review readiness, branch-scoped hierarchy traversal, authorization boundaries, and stale-lineage races. Phase J dashboard/export and AI commentary remain deferred.
