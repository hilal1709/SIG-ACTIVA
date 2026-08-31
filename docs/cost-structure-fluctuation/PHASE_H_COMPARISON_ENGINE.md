# Phase H — Engine 2 Comparison Engine

## Scope and authoritative boundary

Phase H provides read-only, server-side MoM, YoY, and complete-period YTD comparison. It reads only `FINALIZED` Cost Periods through the period's referenced active calculation run, and verifies that run is `SUCCESS`, `isActive=true`, and belongs to the same period. Failed, inactive, superseded, or corrupt lineage fails closed. It never reads workbooks, Storage, `CostSourceRow`, upload/audit rows, or the legacy Fluktuasi OI/EXP module, and it never reruns Engine 1. No schema or migration is introduced.

## Canonical hierarchy and ordering

Only these authoritative `CostCalculationResult` totals become Cost Group nodes:

* Company 2000: `TOTAL_ADUM`, `TOTAL_PASAR`;
* Company 7000: `TOTAL_HPP`, `TOTAL_ADUM`, `TOTAL_PASAR`.

Other future `TOTAL_*` subtotals are not promoted and cannot double count the company. Canonical totals must have unique stable `costGroupId` identities and reconcile exactly to persisted `TOTAL_COMPANY`. Nature totals and analytical items must likewise reconcile to their persisted parent.

Cost Groups follow `CostGroup.displayOrder`; Natures follow `CostNature.displayOrder`. COAs are deterministically ordered by persisted COA code and stable identity, followed by calculated items ordered by their deterministic identity. Thus master business order—not generated-key lexical order—controls the hierarchy.

## API and availability

`GET /api/cost-fluctuation/analysis?periodId=<positive integer>&comparison=MOM|YOY|YTD`

The route reuses Cost Structure read authorization. A non-finalized current period returns HTTP 409. A missing or non-finalized comparison month returns HTTP 200 with `status: "UNAVAILABLE"` and exact `missingPeriods`; it is never substituted with zero. YTD is available only when every January-through-current month is finalized on both sides.

Available responses expose `comparisonType`, a human label such as `MoM: Jul-2026 vs Jun-2026`, `status`, every current/comparison period and run/rule-set lineage entry, and Company → Cost Group → Nature → COA/Calculated Item hierarchy. YTD lineage includes every constituent month. Storage keys, workbook data, and source rows are never returned.

## Financial semantics

* Variance is current minus comparison, with its sign preserved.
* Percentage is variance divided by the absolute comparison amount. A zero comparison with non-zero current is `NM`; two zero amounts produce zero percent.
* Contribution is child variance divided by signed parent variance. A zero parent uses `PARENT_ZERO`; values are neither made absolute nor clamped.
* An item missing inside an otherwise complete finalized period is zero. A missing period is `UNAVAILABLE`.
* COAs use stable `coaId`. A non-COA line uses `natureId + lineType + ruleCode`, remains a `CALCULATED_ITEM`, and never receives a fake COA.
* All authoritative aggregation uses exact `Prisma.Decimal`. Amounts are two-decimal strings; percentage values are deterministic six-decimal strings.

## Automated coverage

Phase H tests cover E2-001 through E2-006 period resolution/availability, month labels, current/comparison finalized gates, active-run integrity, canonical Company 2000/7000 structures, extra subtotal and Derivatif exclusion, business display ordering, missing-item union semantics, calculated-item identity, exact math, signed contribution statuses, hierarchy reconciliation, identical snapshots, repeated-call determinism, and complete YTD lineage. The repository test runner scans both Cost Structure and Cost Fluctuation tests without requiring a production database for Phase H fixtures.

Phase I materiality/commentary/review and Phase J dashboard/export remain explicitly out of scope.
