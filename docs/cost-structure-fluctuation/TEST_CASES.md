# Test Cases V2 — Cost Structure & Fluktuasi Biaya

## 1. Testing philosophy

Financial correctness is the primary release gate.

Tests are grouped into:

1. parser/source tests;
2. source reconciliation tests;
3. mapping/master tests;
4. Engine 1 calculation tests;
5. Engine 1 golden workbook tests;
6. Engine 2 comparison tests;
7. commentary/workflow tests;
8. authorization/security tests;
9. export tests;
10. existing SIG ACTIVA regression tests.

Do not accept UI screenshots as proof of accounting correctness.

## 2. Golden dataset policy

The supplied existing company 2000 and 7000 workbooks are the golden references.

Before hard-coding expected values into fixtures:

- extract the values from the reference workbook;
- independently verify the relevant formulas/source totals;
- document the expected amount and unit;
- use the verified value in automated tests.

Do not invent expected financial values.

## 3. Parser tests — common

### P-001 Workbook readable

Given a valid `.xlsx` source workbook, parser recognizes the workbook and required logical sources.

Expected: PASS.

### P-002 Unsupported/corrupt workbook

Given an unreadable/corrupt workbook.

Expected: blocking validation error; no calculation run.

### P-003 Missing required logical source

Remove a required source sheet.

Expected: `MISSING_SOURCE` blocking issue.

### P-004 Ambiguous sheet match

Two sheets match the same logical source fingerprint.

Expected: `AMBIGUOUS_SHEET`; user must correct source/template.

### P-005 No META dependency

Workbook contains no META sheet while upload form provides company/year/period.

Expected: normal processing.

### P-006 Source period cross-check mismatch

Upload form says Jul-2026 but a source header reliably identifies Jun-2026.

Expected: blocking period mismatch.

### P-007 Accounting negatives

Test source values:

```text
(1,500,000)
1,500,000-
-1500000
```

Expected normalized Decimal: `-1500000`.

### P-008 COA leading zero

Given a COA with leading zeros.

Expected: identifier preserved exactly as String.

## 4. CC Group reconciliation tests

For each required CC Group source:

### CCG-001 Exact match

```text
reported total = sum detail COA
```

Expected: `RECONCILED`, difference 0.

### CCG-002 Detail short

Detail differs by Rp1.

Expected: blocking `CC_GROUP_NOT_RECONCILED`.

### CCG-003 Total row double-count protection

Workbook contains detail rows plus a total row.

Expected: total row excluded from detail sum; reconciliation still exact.

### CCG-004 Subtotals do not double count

Workbook contains intermediate subtotal lines.

Expected: parser uses only valid detail population.

## 5. Mapping tests

### M-001 Known COA

Mapped COA is assigned to expected Company/Cost Group/Nature.

### M-002 Unknown COA

Unknown COA with non-zero amount.

Expected: explicit `UNMAPPED_COA`; never silently zero.

### M-003 Effective-date change

Mapping changes effective Jan-2027.

Expected:

- Jul-2026 uses old mapping;
- Jan-2027 uses new mapping.

### M-004 Exclusion requires reason

Explicit exclusion without reason.

Expected: reject.

### M-005 Mapping completeness

Validated source amount must equal mapped + excluded + reclassified/allocated.

Expected difference 0.

## 6. Engine 1 — Company 2000 tests

### E1-2000-001 Scope

Expected output Cost Groups:

```text
ADUM
PASAR
```

Expected no HPP and no Derivatif output.

### E1-2000-002 Nature roll-up

For each mapped Nature:

```text
Nature total = sum final underlying lines
```

### E1-2000-003 ADUM reconciliation

```text
Total ADUM = sum ADUM Nature
```

Expected difference 0.

### E1-2000-004 PASAR reconciliation

```text
Total PASAR = sum PASAR Nature
```

Expected difference 0.

### E1-2000-005 Golden Cost Structure

Run the verified company 2000 reference month from the supplied workbook.

Expected:

- each validated target Nature/group total matches golden workbook;
- Cost Structure export summary matches golden workbook values.

This test must PASS before starting company 7000 implementation.

### E1-2000-006 SI V2 superseding golden

The prior CC-only golden remains historical evidence but is superseded by ADUM `107844157911`,
PASAR `16487761095`, and company total `124331919006`. Tests cover the dynamic `62140001` delta,
eight-digit-only CC_DRV parsing/control, negative derivative lineage, source-specific 676 mapping,
Product Development zero-net exclusion, 7xx exclusion, and the six SI controls at zero.

Negative control fixtures must also prove that independently supplied Rincian, CC_DRV, SI PASAR,
and company evidence can produce non-zero reconciliation differences. Zero-only unknown support
COAs are non-contributing; a non-zero delta or derivative without active `CostCoa` is blocking.

## 7. Engine 1 — Company 7000 tests

### E1-7000-001 Scope

Expected output:

```text
HPP
ADUM
PASAR
```

No Derivatif.

### E1-7000-002 Total HPP rule

Given verified TB account-group-5 total and COGS Mortar value:

```text
Total HPP = Account Group 5 Total - COGS Mortar
```

Expected exact Decimal equality.

### E1-7000-003 No Excel row dependency

Move COGS Mortar source row to another position without changing account identity/value.

Expected Total HPP unchanged.

### E1-7000-004 Batubara golden formula

Use verified COAL fixture from reference workbook.

Expected Batubara-related outputs match existing validated workbook exactly.

### E1-7000-005 OA golden formula

Use verified OA source fixture.

Expected OA output matches validated workbook exactly and appears under PASAR.

### E1-7000-006 Selisih Persediaan

Given:

```text
H = Total HPP
S = sum HPP natures before Selisih Persediaan
```

Expected:

```text
Selisih Persediaan = H - S
```

### E1-7000-007 HPP reconciliation

Expected:

```text
sum all HPP natures = Total HPP
reconciliation difference = 0
```

### E1-7000-008 Golden Cost Structure

Run verified company 7000 reference month.

Expected HPP/ADUM/PASAR and validated special components match golden workbook.

This test must PASS before Engine 2 implementation is accepted.

## 8. Calculation run tests

### RUN-001 Idempotent

Run twice with identical source/mapping/rules.

Expected exact same financial output.

### RUN-002 No double counting on rerun

A second run creates a new run version rather than adding to prior result.

### RUN-003 Failed run not activated

Force a calculation error.

Expected active finalized result remains prior valid run.

### RUN-004 Source snapshot

Replacement upload v2 is created.

Expected run metadata identifies exactly which upload version was used.

## 9. Finalization tests

### FIN-001 Happy path

All controls pass.

Expected: period can reach `FINALIZED`.

### FIN-002 Unmapped blocker

Unmapped non-zero amount exists.

Expected: finalization blocked.

### FIN-003 Source reconciliation blocker

Any CC Group difference non-zero.

Expected: blocked.

### FIN-004 HPP blocker

7000 HPP reconciliation difference non-zero.

Expected: blocked.

### FIN-005 Reopen

Authorized reviewer/admin reopens finalized period with reason.

Expected audit entry + controlled editable state; prior run preserved.

## 10. Engine 2 — historical availability

### E2-001 MoM normal

Jul-2026 finalized and Jun-2026 finalized.

Expected Jul-Jun variance.

### E2-002 MoM January rollover

Jan-2026 vs Dec-2025.

Expected correct calendar rollover.

### E2-003 YoY

Jul-2026 vs Jul-2025.

### E2-004 YTD

Jan-Jul-2026 vs Jan-Jul-2025.

### E2-005 Missing comparison month

Current period finalized but comparison period absent.

Expected `comparison unavailable`; not calculation against zero.

### E2-006 Incomplete YTD history

One required YTD month is missing.

Expected incomplete/comparison-unavailable status unless business later defines an explicit alternative.

## 11. Engine 2 — percentage tests

### E2P-001 Normal denominator

```text
previous 100
current 120
```

Expected variance 20; percentage 20%.

### E2P-002 Zero denominator

```text
previous 0
current 100
```

Expected variance 100; `variancePercent = null`, status `NM`.

### E2P-003 Both zero

Expected variance 0; percentage 0.

### E2P-004 Negative comparison

Verify denominator uses absolute comparison according to business rule.

## 12. Contribution tests

### CONT-001 Parent variance non-zero

Validate child variance / parent variance.

### CONT-002 Parent variance zero

Expected contribution unavailable/null rather than divide-by-zero.

### CONT-003 Contribution basis label

API/UI clearly identifies whether contribution is to Cost Group or total-company variance.

## 13. Materiality tests

### MAT-001 Below threshold

Expected `NORMAL`.

### MAT-002 Meets explanation threshold

Expected `REQUIRES_EXPLANATION`.

### MAT-003 Effective-date threshold change

Old period uses old threshold; new period uses new threshold.

## 14. Commentary workflow tests

### COM-001 Separate comparison reasons

MoM, YoY, YTD can hold different reasons for same Nature.

### COM-002 Draft -> Submitted

Valid preparer transition.

### COM-003 Submitted -> Returned

Reviewer note required when configured.

### COM-004 Returned -> Draft -> Submitted

History retained.

### COM-005 Review authorization

Unauthorized preparer cannot self-review through API.

## 15. Authorization tests

### AUTH-001 Unauthenticated

All module APIs return 401.

### AUTH-002 Read role

Authorized reader can view finalized Cost Structure/analysis but cannot upload/finalize.

### AUTH-003 Prepare role

STAFF_ACCOUNTING can upload/run allowed actions but cannot perform restricted admin operation.

### AUTH-004 Reviewer

SUPERVISOR_ACCOUNTING can execute review/finalize actions according to policy.

### AUTH-005 Admin

ADMIN_SYSTEM can maintain module masters/reopen with reason.

### AUTH-006 Existing API isolation

New authorization helpers do not alter existing `/api/fluktuasi/*`, accrual or prepaid permissions.

## 16. Export tests

### EXP-001 Cost Structure 2000 workbook

Expected sheets/sections:

```text
Summary
ADUM
PASAR
COA Detail
Reconciliation
Source Trace
```

### EXP-002 Cost Structure 7000 workbook

Includes HPP.

### EXP-003 Fluctuation export

Includes Executive Summary, MoM, YoY, YTD, group detail and commentary.

### EXP-004 Export totals

Every exported total matches finalized database result.

### EXP-005 Formula injection protection

User commentary/source text beginning with formula characters is exported as text when intended.

## 17. Performance/volume tests

Test representative and upper-bound workbook sizes.

At minimum measure:

- parse time;
- validation time;
- calculation time;
- memory behavior;
- export generation.

Do not optimize by sacrificing reconciliation/lineage.

## 18. Existing SIG ACTIVA regression checklist

Before merge/deploy verify at minimum:

```text
Login/session works
Main dashboard opens
Laporan Material opens
Fluktuasi OI/EXP opens
Overview Fluktuasi opens
Detail Per Akun opens
Monitoring Prepaid opens
Monitoring Accrual opens
User Management admin access remains valid
Security Status remains valid
Existing build/lint checks pass
```

## 19. Phase gates

```text
Parser/source tests pass
    ↓
2000 Engine 1 golden tests pass
    ↓
7000 Engine 1 golden tests pass
    ↓
Engine 1 dashboard/export
    ↓
Engine 2 tests pass
    ↓
Commentary/review
    ↓
Final dashboard/export
    ↓
Regression/security hardening
```

Do not bypass the two golden Engine 1 gates.


## Engine 2 V2 analysis bases (2026-08-31)

Engine 2 derives only from a FINALIZED period and its active SUCCESS calculation run/upload. Company 2000 has one `SI` analysis basis (final Engine 1 V2 detail independently controlled against `AUDIT_SI`). Company 7000 has separate additive `GHOPO` and `DERIV` analysis bases: GHOPO retains finalized Engine 1 detail and is controlled against `AUDIT_GHOPO`; DERIV is parsed from `AUDIT_DERIV` on that same upload in Rp-thousand and normalized to full IDR. DERIV remains excluded from Company 7000 Engine 1 and is never a Cost Group.

The hierarchy and stable identity are Company -> Analysis Basis -> Cost Group -> Nature -> COA/calculated item. Keys are basis-qualified (`basis:<BASIS>:group:<id>:nature:<id>:...`) and monthly run/upload identity remains lineage, not node identity. All parity uses Decimal normalization to two financial decimal places. Missing source controls and non-reconciling finalized sources are integrity failures, while missing comparison periods remain `UNAVAILABLE`.

PR #23 remains HOLD. Its Phase I assumptions about legacy unqualified analysis keys are superseded; after Engine 2 V2 merges, Phase I must be rebased and adapted separately. Phase I materiality, commentary, and review are not part of this redesign.
