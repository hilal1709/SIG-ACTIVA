# Raw V2 Stage D Implementation Contract

Status: PREPARATION / LOCKED FOR IMPLEMENTATION
Scope: Company 2000 analytical base and TB↔CC reconciliation only

## Objective

Stage D starts from a VALIDATED, active Raw V2 upload and builds an isolated analytical base for Company 2000. It must reconcile the cost-center sources against the relevant TB cost population before any Rincian/SI calculation is treated as authoritative.

Raw SAP upload
→ validated TB + CC sources
→ relevant TB cost population
→ TB↔CC reconciliation evidence
→ analytical rows by source / COA
→ ready-for-Rincian output

Stage D must not alter the legacy Cost Structure engine or its persisted transactions.

## Inputs

Only active VALIDATED `CostRawV2Upload` data may be used.

Authoritative Stage C sources for Company 2000:
- TB: REQUIRED
- CC_ADUM: REQUIRED
- CC_PASAR: REQUIRED
- CC_PROD: OPTIONAL-ZERO
- CC_DERIV: OPTIONAL-ZERO

Stage C parsing/reconciliation remains unchanged:
- TB monthly amount = Variance
- CC financial authority = Excel B:K
- CC source controls = SUM(detail Act. Costs) = Debit
- all arithmetic = Decimal / NUMERIC, no JS float

## Why total TB must not be compared directly to total CC

The TB contains the full company trial balance, so the net of all TB monthly variance can legitimately be zero. The correct Stage D reconciliation compares CC values only against the subset of TB accounts that belong to the relevant cost population after explicit mapping/rules.

Therefore:

`SUM(all TB)` is NOT a reconciliation target for `SUM(CC)`.

Stage D must expose:
- total TB rows
- relevant TB cost rows
- relevant TB cost amount
- CC source totals
- mapped/reconciled amount
- unexplained residual

No unexplained residual may be silently converted to zero.

## Company 2000 business flow

Current target analytical flow:

`CC_ADUM / CC_PASAR raw`
→ mappings
→ dynamic Rincian correction overlay
→ Rincian analytical base
→ optional `CC_DERIV` negative PASAR overlay
→ final SI

Company 2000 CC_PROD is optional-zero at the raw boundary and must remain zero when absent.

CC_DERIV is period-optional:
- absent = zero dependency
- present all-zero = zero
- present non-zero = must reconcile fail-closed

Stage D does NOT yet finalize SI. It prepares the reconciled analytical base and evidence needed for the next calculation stage.

## Mapping requirements

Do not guess mapping rules from raw data.

Stage D may reuse existing approved COA/Nature mapping master data only when the mapping semantics are explicitly compatible with Company 2000 Raw V2. Any incompatible or ambiguous mapping must be surfaced as an issue.

Each analytical row must retain lineage to:
- upload id
- raw source row id
- logical source code
- original sheet
- original source row number
- raw COA
- raw description
- raw amount
- resolved COA / mapping identifier when applicable
- analytical classification
- mapped amount
- rule/version metadata

## Reconciliation outputs

At minimum persist/report these controls per calculation run:

### Raw source controls
- TB row count / non-zero count
- CC_ADUM detail count and Debit
- CC_PASAR detail count and Debit
- CC_DERIV detail count and Debit when present
- CC_PROD zero/present status

### TB cost-population controls
- total TB detail rows
- rows included in relevant cost population
- rows excluded with reason
- relevant TB cost total
- unmapped relevant TB total

### CC controls
- CC_ADUM total
- CC_PASAR total
- CC_DERIV total
- CC_PROD total
- combined CC analytical source total

### Cross-source controls
- mapped TB amount represented in CC analytical base
- CC amount represented by mapped TB population
- residual / unexplained amount
- reconciliation status PASS / FAIL

Exact arithmetic only. A non-zero unexplained residual must block a successful calculation run unless an explicit approved adjustment/rule explains it.

## Persistence

Use isolated Raw V2 models/tables only.

Stage D may add additive tables such as:
- `cost_raw_v2_analytical_rows`
- `cost_raw_v2_reconciliations`

or equivalent dedicated Raw V2 models.

Do not write to legacy:
- CostPeriod
- CostUpload
- CostSourceRow
- CostValidationIssue
- CostCalculationRun
- legacy active calculation pointers

Each calculation run must snapshot:
- active upload/version
- ruleset `ENGINE1_2000_RAW_V3`
- mapping/rule version references
- source totals
- reconciliation totals

The unique one-active-calculation-run-per-period invariant from Stage B remains mandatory.

## Calculation run safety

A Stage D calculation may start only when:
- period exists in Raw V2
- active upload exists
- active upload status = VALIDATED
- upload has no unresolved ERROR issues
- Company 2000 required sources are present

Calculation must be atomic:
- build new run as non-active / RUNNING
- persist analytical rows and reconciliation evidence
- if any blocking issue occurs, mark FAILED and keep prior successful active run unchanged
- only after all controls PASS may the new run become SUCCESS + active
- supersede/deactivate old active run atomically

No automatic finalization.

## API/UI target

Add isolated endpoints under:
- `/api/cost-structure/raw-v2/...`

Suggested Stage D actions:
- POST calculate/reconcile for selected period
- GET calculation/reconciliation result

Raw V2 UI should show a high-level reconciliation dashboard before any downstream Rincian/SI result:
- active upload status
- TB 502-style row coverage indicator (count/non-zero, not only net total)
- CC source controls
- relevant TB cost population
- mapped vs unmapped amount
- residual
- PASS/FAIL

## Current private acceptance benchmark

For the verified Company 2000 August 2026 source workbook, Stage C currently validates:
- TB: 502 COA rows, 249 non-zero rows, net full-TB monthly variance 0
- CC_ADUM: 138 rows, total 202,328,795,213, difference 0
- CC_PASAR: 63 rows, total 15,599,456,666, difference 0
- CC_DERIV: 36 rows, total 3,460,258,896, difference 0
- CC_PROD: absent treated as zero

These are acceptance controls, not hard-coded production constants.

The existing July 2026 Company 2000 V2 final SI golden remains:
- ADUM 107,844,157,911
- PASAR 16,487,761,095
- TOTAL 124,331,919,006

Do not force August raw CC totals to equal the July SI golden. They represent different stages/periods.

## Hard exclusions for Stage D

Do NOT:
- change Stage C parser rules except separately reviewed bugfixes
- implement Company 7000 calculation
- implement final SI export
- implement Engine 2 fluctuation analysis
- finalize/reopen periods
- remove the legacy engine
- silently post balancing adjustments
- hard-code private workbook values

## Tests

Required synthetic tests should cover:
- calculation blocked when no active VALIDATED upload
- calculation blocked when upload has ERROR issue
- Decimal exact reconciliation
- all-TB net zero does not imply no TB data
- relevant TB population is distinct from full TB
- unmapped TB row is surfaced, not dropped
- non-zero residual fails closed
- failed new run does not replace prior active SUCCESS run
- successful run atomically becomes the only active run
- optional-zero CC_PROD/CC_DERIV behavior
- no writes to legacy transaction models

Private acceptance should be rerun against the verified August workbook after implementation.
