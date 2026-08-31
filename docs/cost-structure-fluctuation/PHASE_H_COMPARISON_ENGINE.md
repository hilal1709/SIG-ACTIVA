# Phase H — Engine 2 Comparison Engine

## Scope and boundary

Phase H provides a read-only, server-side MoM, YoY, and complete-period YTD comparison service. It reads only `FINALIZED` Cost Periods through their active, successful, active Engine 1 calculation run. It does not read workbooks, source rows, uploads, audit rows, or the legacy Fluktuasi OI/EXP module. No schema or migration is introduced.

## API

`GET /api/cost-fluctuation/analysis?periodId=<positive integer>&comparison=MOM|YOY|YTD`

The route uses existing Cost Structure read authorization. A non-finalized current period returns HTTP 409. Missing/non-finalized comparison history returns HTTP 200 with `status: "UNAVAILABLE"` and `missingPeriods`; it is never substituted with zero. Invalid finalized active-run lineage is a data-integrity error.

Available responses include current and comparison run/rule-set lineage and a Company → Cost Group → Nature → COA/Calculated Item hierarchy. Monetary values are fixed two-decimal strings. Percentages and contributions are deterministic six-decimal percentage strings.

## Financial semantics

* Variance is current minus comparison, with its sign preserved.
* Percentage is variance divided by the absolute comparison amount. A zero comparison with non-zero current is `NM`; two zero amounts produce zero percent.
* Contribution is child variance divided by signed parent variance. A zero parent uses `PARENT_ZERO`; values are neither made absolute nor clamped.
* The union of analytical keys is compared, so an item absent from one complete finalized snapshot is zero. Missing periods remain unavailable.
* COAs use stable `coaId` identity. Non-COA lines use `natureId + lineType + ruleCode`, remain explicit calculated items, and never receive fake COAs.
* YTD requires every month from January through the requested month in both years, then aggregates exact Decimal snapshots in memory.

Phase I materiality/commentary/review and Phase J dashboard/export remain out of scope.
