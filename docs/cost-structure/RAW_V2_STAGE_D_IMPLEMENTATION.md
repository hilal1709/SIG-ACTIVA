# Raw V2 Stage D Implementation Contract

Status: PREPARATION / LOCKED FOR IMPLEMENTATION
Scope: Company 2000 analytical base and TB↔CC reconciliation only

## Objective

Stage D starts from a VALIDATED, active Raw V2 upload and builds an isolated analytical base for Company 2000. It must first prove the authoritative raw reconciliation between TB and the two base Cost Center sources, then preserve CC_DERIV as a separate subset/evidence used later as a PASAR deduction in SI.

Raw SAP upload
→ validated TB + CC sources
→ per-COA TB = CC_ADUM + CC_PASAR reconciliation
→ mapping / analytical base
→ Rincian correction overlay
→ CC_DERIV PASAR deduction
→ ready-for-SI output

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

## Locked raw TB reconciliation rule

For Company 2000, the authoritative raw reconciliation is:

`TB = CC_ADUM + CC_PASAR`

This equality must be tested by COA, not merely by grand total.

For every unique COA appearing in `CC_ADUM ∪ CC_PASAR`:

`TB amount for COA = SUM(CC_ADUM amount for COA) + SUM(CC_PASAR amount for COA)`

Controls:
- every unique COA from CC_ADUM/CC_PASAR must exist in TB;
- TB may contain additional COAs outside this population;
- per-COA difference must be zero;
- total difference across the same COA population must be zero;
- any non-zero difference is a visible blocking exception and must never be silently balanced.

`SUM(all TB)` is not the reconciliation target because the complete trial balance can net to zero. The target is the TB amount restricted to the unique COA population represented by CC_ADUM and CC_PASAR.

## Locked CC_DERIV treatment

`CC_DERIV` is not additive to the raw TB reconciliation because its amounts are already contained within `CC_PASAR`.

Therefore DO NOT calculate:

`TB = CC_ADUM + CC_PASAR + CC_DERIV`

That would double count DERIV.

CC_DERIV is a separately validated subset/evidence source used later in the Cost Structure/SI calculation. Its business role is:

`PASAR SI = PASAR analytical base - DERIV contribution`

The derivative source must independently satisfy its own Stage C detail-to-Debit reconciliation before it can be used as a deduction.

Period semantics:
- absent CC_DERIV = zero deduction;
- present all-zero CC_DERIV = zero deduction;
- present non-zero CC_DERIV = reconcile fail-closed, then deduct according to the approved PASAR SI mapping;
- malformed/error CC_DERIV is never treated as zero.

## CC_PROD

Company 2000 `CC_PROD` remains optional-zero at the raw boundary. It is not an additive component of the locked Company 2000 TB equality `TB = CC_ADUM + CC_PASAR`.

## Company 2000 business flow

Current target analytical flow:

`CC_ADUM / CC_PASAR raw`
→ exact TB per-COA reconciliation
→ mappings
→ dynamic Rincian correction overlay
→ Rincian analytical base
→ optional `CC_DERIV` negative PASAR overlay
→ final SI

Stage D does NOT finalize SI. It prepares the reconciled analytical base and evidence needed for the next calculation stage.

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

At minimum persist/report these controls per calculation run.

### Raw source controls
- TB row count / non-zero count
- CC_ADUM detail count and Debit
- CC_PASAR detail count and Debit
- CC_DERIV detail count and Debit when present
- CC_PROD zero/present status

### TB↔base-CC controls
- unique COA count from `CC_ADUM ∪ CC_PASAR`
- unique CC COAs found in TB
- unique CC COAs missing in TB
- exact-match COA count
- mismatch COA count
- per-COA TB amount
- per-COA CC_ADUM amount
- per-COA CC_PASAR amount
- per-COA difference = TB - ADUM - PASAR
- total TB amount over the CC base COA population
- total CC_ADUM + CC_PASAR over the same population
- total difference
- reconciliation status PASS / FAIL

### Mapping controls
- included amount
- explicitly excluded amount
- reclassified/allocated amount where applicable
- unmapped non-zero amount
- ambiguous mapping amount

### DERIV controls
- CC_DERIV source total
- CC_DERIV detail-to-Debit difference
- mapped derivative deduction amount
- unmapped derivative amount
- derivative deduction readiness PASS / FAIL

Exact arithmetic only. A missing base CC COA in TB, non-zero per-COA TB difference, non-zero unmapped amount, ambiguous mapping, or non-reconciling derivative source must fail closed.

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
- TB↔CC per-COA controls
- source totals
- derivative controls

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

Raw V2 UI should show a high-level reconciliation dashboard before downstream Rincian/SI:
- active upload status
- TB row coverage indicator (count/non-zero, not only net total)
- unique base CC COA coverage versus TB
- exact-match / mismatch COA counts
- total TB over base CC COAs
- total CC_ADUM + CC_PASAR
- total difference
- drill-down mismatch COAs
- CC_DERIV independent source control and future PASAR deduction amount
- mapping coverage and unmapped amount
- PASS / FAIL

## Current private acceptance benchmark

For the verified Company 2000 August 2026 source workbook, Stage C currently validates:
- TB: 502 COA rows, 249 non-zero rows, full-TB net monthly variance 0
- CC_ADUM: 138 rows, total 202,328,795,213, source difference 0
- CC_PASAR: 63 rows, total 15,599,456,666, source difference 0
- CC_DERIV: 36 rows, total 3,460,258,896, source difference 0
- CC_PROD: absent treated as zero

Current raw TB↔base-CC diagnostic from production:
- 142 unique COAs across CC_ADUM/CC_PASAR
- 142 found in TB
- 141 exact-match COAs
- 1 mismatch COA: `62140001`
- CC_ADUM + CC_PASAR for `62140001` = 42,529,224
- TB for `62140001` = 42,533,026
- difference = 3,802

This Rp3,802 difference is a blocking source exception until its source cause is resolved. It is not explained by CC_DERIV; the private workbook itself contains those displayed values.

These acceptance figures are diagnostics, not hard-coded production constants.

The existing July 2026 Company 2000 V2 final SI golden remains:
- ADUM 107,844,157,911
- PASAR 16,487,761,095
- TOTAL 124,331,919,006

Do not force August raw CC totals to equal the July SI golden. They represent different stages/periods.

## Hard exclusions for Stage D

Do NOT:
- add CC_DERIV to CC_PASAR for TB reconciliation
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
- every unique base CC COA must exist in TB
- exact per-COA Decimal equality `TB = CC_ADUM + CC_PASAR`
- TB may contain additional COAs
- full-TB net zero does not imply no TB data
- CC_DERIV is not added to the TB equality
- CC_DERIV is retained as an independent future PASAR deduction
- one non-zero per-COA mismatch fails closed
- unmapped non-zero row is surfaced, not dropped
- failed new run does not replace prior active SUCCESS run
- successful run atomically becomes the only active run
- optional-zero CC_PROD/CC_DERIV behavior
- no writes to legacy transaction models

Private acceptance must be rerun against the verified August workbook after implementation.
