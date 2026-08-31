# Phase I — Materiality, Commentary, and Review

## Scope and schema

Phase I adds `CostMaterialityRule`, `CostCommentary`, append-only `CostCommentaryHistory`, and one `CostPeriodReview` per Cost Period. It is an overlay on Phase H and never persists or changes analytical/accounting amounts. Thresholds are PostgreSQL numeric (`20,2` amount and `20,6` percentage points); no default business threshold is seeded.

## Materiality

Rules are resolved at the current period's `periodEnd`, first by Company + Cost Group + comparison, then by Company-wide + comparison. Resolution never crosses Company/comparison and multiple rules at one specificity are integrity errors. Exact-scope active intervals may not overlap. A successor is created after end-dating its predecessor rather than rewriting history.

Magnitude uses absolute variance. Threshold equality passes. `OR` requires any PASS; without PASS an unevaluable configured criterion yields `NOT_EVALUABLE`. `AND` returns NORMAL on any FAIL, otherwise `NOT_EVALUABLE` when needed, otherwise requires explanation. An N/M percentage is unevaluable, never zero. Missing rules are `NOT_CONFIGURED`, unavailable comparisons are `UNAVAILABLE`, and Company roots are `NOT_APPLICABLE`.

## Commentary identity, lineage, and workflow

Canonical Phase H keys identify COST_GROUP, NATURE, COA, and CALCULATED_ITEM targets; calculated items never receive fake COAs. The server validates the target against the current hierarchy. A SHA-256 digest over stable current/comparison period, run, rule-set, and comparison serialization binds each record to exact lineage. Old-lineage records remain historical and are not returned as current.

OPEN is derived for material nodes without a record. Persisted transitions are `DRAFT -> SUBMITTED -> REVIEWED` or `DRAFT -> SUBMITTED -> RETURNED -> DRAFT`. Submit requires a reason; return requires a note; reviewed rows are immutable. Reviewer and preparer IDs come from the session, and maker/checker prohibits self-review. Each save/transition atomically updates commentary, appends a monotonic history version, and writes `CostAuditLog`.

## Period review and authorization

Review completion requires a FINALIZED period, at least one AVAILABLE comparison, deterministic configured/evaluable materiality for all available output, and REVIEWED current-lineage commentary for every required node. Unavailable comparisons do not create false blockers. Completion writes review evidence/audit without changing `CostPeriod.status`.

Read uses existing finance read roles; draft/submit uses ADMIN_SYSTEM or STAFF_ACCOUNTING; return/review/complete uses ADMIN_SYSTEM or SUPERVISOR_ACCOUNTING; rule administration is ADMIN_SYSTEM only. Every mutation checks authorization in the route.

## APIs and UI

Read materiality at `GET /api/cost-fluctuation/materiality`. Rule administration is under `/api/cost-fluctuation/materiality-rules`. Commentary overlay/draft/submit/return/review routes are under `/api/cost-fluctuation/commentary`; review readiness/completion is under `/api/cost-fluctuation/review`. `/cost-fluctuation` displays the workflow overlay, while `/cost-fluctuation/materiality-rules` provides the small admin configuration form.

## Migration and validation

The additive migration is `prisma/migrations/20260831120000_phase_i_materiality_commentary_review/migration.sql`. It creates only Phase I enums, tables, indexes, constraints, and foreign keys. It must be externally reviewed and applied through controlled Supabase tooling; Codex did not apply it to production. Tests cover rule priority/effective dating, exact/absolute thresholds, AND/OR and N/M logic, no-rule/company states, ambiguity, and deterministic lineage. Phase J charts, dashboard/export, and AI commentary remain deferred.
