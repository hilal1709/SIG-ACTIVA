# Calculation Rules V2

## Company 2000 Engine 1 V2 — superseding SI contract

New runs persist final SI: mapped CC_ADUM/CC_PASAR plus dynamic persisted Rincian-by-COA deltas,
then reconciled eight-digit CC_DRV details as negative PASAR contributions using PASAR mappings.
No July-specific amount is production logic; every overlay retains COA/source-row lineage.

Only non-zero support contributions require an active `CostCoa`; zero-only Rincian/CC_DRV labels are
ignored. Reconciliation compares calculated lines with independently summed persisted Rincian and
CC_DRV controls. Approved manual adjustments are added after Rincian evidence. Explicitly excluded
equal base/derivative evidence remains in the full source control but is removed from both sides of
the SI analytical basis, preserving a zero net effect.

## Phase F — Company 7000 Engine 1 contract

`ENGINE1_7000_V1` implements the deterministic Company 7000 scope `HPP`, `ADUM`, and `PASAR` (with OA inside PASAR). `HPP_TOTAL_7000` subtracts explicitly identified account-group-5 COGS Mortar from the account-group-5 total. `COAL_7000_EXISTING`, `COAL_INBOUND_7000_EXISTING`, and `OA_7000_EXISTING` consume server-resolved dependencies and retain their source-row lineage. `HPP_INVENTORY_DIFF_7000` is a COA-less residual equal to Total HPP less all preceding HPP Natures.

Authoritative Cost Structure financial amounts remain NUMERIC/Decimal(20,2). Company 7000 source formulas may contain higher precision, but authoritative values are normalized to two decimal places before final Nature/residual reconciliation.

## 1. General rule

All accounting calculations are deterministic server-side calculations.

Do not calculate authoritative Cost Structure values in React components.

Do not use AI to calculate accounting amounts or choose financial formulas.

All monetary values use Decimal-compatible arithmetic.

## 2. Engine 1 processing order

The monthly calculation pipeline is fixed conceptually:

```text
1. Parse source workbook
2. Normalize source values
3. Validate required logical sources
4. Reconcile CC Group source totals
5. Resolve mapping/exclusion/reclassification
6. Apply validated existing formula rules
7. Build Cost Group/Nature/COA results
8. Calculate formula/residual items
9. Reconcile final Cost Structure
10. Persist versioned calculation run
11. Finalize period only if all blocking controls pass
```

## 3. Source reconciliation

For every logical Cost Center Group source that contains a reported total:

```text
sourceDifference
=
reportedCcGroupTotal
-
sum(normalized detail COA rows)
```

Acceptance:

```text
sourceDifference = 0
```

A non-zero difference is blocking.

Parser logic must exclude headers, subtotal rows and total rows from detail aggregation.

## 4. Mapping completeness

After source reconciliation:

```text
validatedSource
=
mappedAmount
+ explicitlyExcludedAmount
+ reclassifiedAllocatedAmount
```

Unaccounted amount must be zero.

Unknown COA creates a mapping issue.

## 5. Normal mapped nature

For a normal mapped nature:

```text
Nature Amount
=
SUM(final mapped COA lines for the Nature)
```

The application must be able to show the underlying line composition.

## 6. Adjustment handling

Controlled adjustments are separate lines in calculation lineage.

For an applicable target:

```text
Final Amount
=
Base Mapped/Formula Amount
+ Approved Explicit Adjustments
```

Do not overwrite source amount with adjusted amount without preserving both values.

## 7. Company 2000

Engine 1 forms only:

```text
ADUM
PASAR
```

The source-to-nature/allocation behavior follows the validated existing company 2000 workbook.

No HPP calculation is executed for company 2000.

For Company 7000 Engine 1, DERIV is ignored; Company 7000 Engine 2 consumes it only as a separate analysis basis.

## 8. Company 7000

Engine 1 forms:

```text
HPP
ADUM
PASAR
```

The general mapping/allocation principle remains consistent with company 2000, with additional validated 7000 formula sources and HPP control.

## 9. Rule HPP_TOTAL_7000

Authoritative Total HPP:

```text
Total HPP
=
Total cost of account group 5
-
Account-group-5 COGS Mortar
```

Implementation rules:

- Read normalized TB/account data.
- Select account-group-5 population using validated account/master criteria.
- Identify COGS Mortar through an explicit rule/master mapping.
- Never select COGS Mortar by hard-coded Excel row number.
- Preserve calculation detail for lineage.

Pseudo-result detail:

```text
Account Group 5 Total      X
Less: COGS Mortar          Y
----------------------------
Total HPP                   X - Y
```

## 10. HPP mapped/formula natures

All natures before Selisih Persediaan are calculated according to their configured mapped or validated existing formula type.

The application must not simplify validated formula natures into generic SUM(COA) if the existing workbook uses a distinct calculation.

## 11. Rule COAL_7000_EXISTING

Batubara, Batubara Inbound and related existing split follow the validated existing workbook formula.

Before implementation:

- trace exact source fields from the golden 7000 workbook;
- create test fixtures;
- record exact expected results;
- implement the same arithmetic in a dedicated domain function.

The code may improve naming/structure but must produce the same result.

No external workbook link may be required at runtime; required raw inputs must exist in the uploaded source workbook or approved system configuration.

## 12. Rule OA_7000_EXISTING

OA follows the validated existing workbook formula.

Hierarchy:

```text
7000 / PASAR / OA
```

OA is part of PASAR.

Before implementation, trace exact dependencies between CC_PASAR, OA_STAT and any other validated source used by the reference workbook.

Runtime result must not depend on external Excel links.

## 13. Rule HPP_INVENTORY_DIFF_7000

Selisih Persediaan is residual, not direct-input COA detail.

Let:

```text
H = Total HPP
S = sum of all HPP Nature amounts from Bahan Baku through the last Nature before Selisih Persediaan
```

Then:

```text
Selisih Persediaan = H - S
```

Store it as:

```text
lineType = RESIDUAL
ruleCode = HPP_INVENTORY_DIFF_7000
coaId = null
```

Do not create a fake COA.

## 14. HPP final reconciliation

After calculating Selisih Persediaan:

```text
HppNatureTotal
=
SUM(all HPP natures including Selisih Persediaan)
```

Then:

```text
HppReconciliationDifference
=
Total HPP - HppNatureTotal
```

Acceptance:

```text
HppReconciliationDifference = 0
```

This is a hard finalization gate.

## 15. ADUM/PASAR final reconciliation

For each group:

```text
GroupTotal = SUM(all final Nature amounts in group)
```

If an authoritative independent control total exists in the validated workbook logic, store and compare it explicitly.

At minimum, Nature detail must roll up exactly to the reported final Cost Group amount.

## 16. Calculation run idempotency

For identical:

- active upload version;
- normalized source data;
- mapping effective context;
- adjustments;
- rule-set version;

then:

```text
Run A output = Run B output
```

Do not incrementally add a rerun onto existing result rows. Build a new isolated run and activate only the successful intended run.

## 17. Finalization

A calculation run may become finalized only if:

```text
required source complete
AND no blocking validation errors
AND source CC controls = 0 difference
AND mapping unaccounted amount = 0
AND calculation successful
AND final group controls pass
AND HPP reconciliation = 0 where applicable
```

## 18. Engine 2 source rule

Engine 2 reads only finalized Engine 1 results.

For each company/period, use the active finalized calculation run.

Never use:

- raw source rows;
- superseded upload versions;
- failed calculation runs;
- non-finalized periods.

## 19. MoM

For current fiscal month `M/Y`:

```text
MoM comparison period = previous calendar month
```

Examples:

```text
Jul-2026 vs Jun-2026
Jan-2026 vs Dec-2025
```

For each requested analysis grain:

```text
varianceAmount = currentAmount - comparisonAmount
```

## 20. YoY

For current fiscal month `M/Y`:

```text
YoY comparison period = M/(Y-1)
```

Example:

```text
Jul-2026 vs Jul-2025
```

## 21. YTD

For current fiscal month `M/Y`:

```text
currentYtd = SUM(Jan..M of Y)
priorYtd   = SUM(Jan..M of Y-1)
variance   = currentYtd - priorYtd
```

Only finalized monthly Engine 1 records are included.

If the required historical period set is incomplete, the service must return an incomplete/comparison-unavailable status instead of silently filling missing months with zero.

## 22. Variance percentage

When comparison is non-zero:

```text
variancePercent
=
(current - comparison) / ABS(comparison)
```

When:

```text
comparison = 0
current != 0
```

return:

```text
variancePercent = null
variancePercentStatus = NM
```

When both are zero:

```text
variancePercent = 0
```

Missing comparison is not the same state as denominator zero.

## 23. Contribution

Contribution measures a child movement relative to the selected parent/net movement.

Baseline:

```text
contributionPercent
=
childVariance / parentVariance
```

when parent variance is non-zero.

The UI must make the contribution basis explicit, e.g. contribution to HPP variance or contribution to total company variance.

## 24. Materiality

Materiality evaluation reads configured thresholds and returns workflow status.

Possible statuses:

```text
NORMAL
REQUIRES_EXPLANATION
SIGNIFICANT
```

Materiality does not alter amounts or variance calculations.

## 25. Commentary

Commentary is keyed separately by comparison type.

Examples:

```text
7000 / Jul-2026 / HPP / Batubara / MOM
7000 / Jul-2026 / HPP / Batubara / YOY
7000 / Jul-2026 / HPP / Batubara / YTD
```

Do not automatically reuse one reason for another comparison type.

## 26. Golden calculation tests

For each supplied golden workbook:

- verify parser source totals;
- verify each relevant Cost Group total;
- verify major/special Nature results;
- verify Total HPP formula;
- verify Selisih Persediaan formula;
- verify HPP reconciliation;
- verify OA/Batubara formulas;
- verify system-generated report totals match validated workbook output.

Golden expected values must be extracted and reviewed from the supplied workbooks before being committed as constants/fixtures.

## 27. No silent fallback

Never implement fallback logic such as:

```text
missing mapping -> 0
missing source -> 0
formula error -> previous value
missing comparison -> 0
```

A financial exception must remain visible and block or clearly mark the affected process.


## Engine 2 V2 analysis bases (2026-08-31)

Engine 2 derives only from a FINALIZED period and its active SUCCESS calculation run/upload. Company 2000 has one `SI` analysis basis (final Engine 1 V2 detail independently controlled against `AUDIT_SI`). Company 7000 has separate additive `GHOPO` and `DERIV` analysis bases: GHOPO retains finalized Engine 1 detail and is controlled against `AUDIT_GHOPO`; DERIV is parsed from `AUDIT_DERIV` on that same upload in Rp-thousand and normalized to full IDR. DERIV remains excluded from Company 7000 Engine 1 and is never a Cost Group.

The hierarchy and stable identity are Company -> Analysis Basis -> Cost Group -> Nature -> COA/calculated item. Keys are basis-qualified (`basis:<BASIS>:group:<id>:nature:<id>:...`) and monthly run/upload identity remains lineage, not node identity. All parity uses Decimal normalization to two financial decimal places. Missing source controls and non-reconciling finalized sources are integrity failures, while missing comparison periods remain `UNAVAILABLE`.

PR #23 remains HOLD. Its Phase I assumptions about legacy unqualified analysis keys are superseded; after Engine 2 V2 merges, Phase I must be rebased and adapted separately. Phase I materiality, commentary, and review are not part of this redesign.
