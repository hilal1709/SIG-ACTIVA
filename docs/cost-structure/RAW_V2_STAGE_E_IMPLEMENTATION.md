# Raw SAP Engine 1 V2 — Stage E Mapping, Rincian & SI (Company 2000)

## 1. Scope

Stage E is the next isolated Raw V2 phase after Stage D reconciliation.

Stage E is **Company 2000 only** and implements:

1. effective mapping resolution for `CC_ADUM` and `CC_PASAR`;
2. deterministic Rincian reconstruction from Raw SAP TB + CC;
3. `CC_DERIV` as a negative PASAR overlay using the effective `CC_PASAR` mapping;
4. mapped analytical rows with lineage;
5. Nature, Cost Group and Company SI totals;
6. final Stage E reconciliation controls and an active Raw V2 SUCCESS run only when all Stage E controls pass.

Stage E does **not** implement Company 7000, export, Engine 2, period finalization/reopen, or manual adjustment workflow.

Ruleset remains:

```text
ENGINE1_2000_RAW_V3
```

Legacy `ENGINE1_2000_V2` remains operational and must not be modified.

## 2. Authoritative inputs

Stage E consumes only the active `VALIDATED` Raw V2 upload for Company 2000 and reads existing system masters/configuration as read-only references.

Raw input families:

```text
TB
CC_ADUM
CC_PASAR
CC_DERIV (optional-zero)
CC_PROD  (optional-zero; no Company 2000 SI contribution in this stage)
```

Authoritative raw monetary arithmetic uses `Prisma.Decimal` / PostgreSQL `NUMERIC`. No JavaScript floating-point financial arithmetic is allowed.

## 3. Stage D relationship

Stage D remains an exact source diagnostic:

```text
TB per COA = CC_ADUM per COA + CC_PASAR per COA
```

A non-zero Stage D difference remains visible and is never silently balanced.

Stage E may proceed from a Stage D `FAIL` **only when**:

- all unique ADUM/PASAR COAs are present in TB;
- no required source is missing;
- source-level CC controls reconcile exactly;
- all non-zero DERIV COAs are contained in PASAR;
- the Stage D difference is handled explicitly by the locked Rincian rule below.

Thus Stage D failure remains diagnostic evidence; Stage E does not rewrite or resolve the Stage D record.

## 4. Locked Rincian reconstruction rule

Raw SAP does not require a monthly user-uploaded Rincian sheet.

For every COA in the union of `CC_ADUM ∪ CC_PASAR`:

```text
Raw ADUM      = SUM(CC_ADUM amount for COA)
Raw PASAR     = SUM(CC_PASAR amount for COA)
TB Amount     = TB amount for COA

Rincian PASAR = Raw PASAR
Rincian ADUM  = TB Amount - Rincian PASAR

ADUM Delta    = Rincian ADUM - Raw ADUM
              = TB Amount - Raw ADUM - Raw PASAR

PASAR Delta   = 0
```

The delta is an explicit system-generated analytical correction with full lineage. It is **not** an arbitrary balancing entry.

Historical evidence from all finalized Company 2000 `ENGINE1_2000_V2` periods Jan–Sep 2026 confirms:

- Rincian total always equals Rincian ADUM + Rincian PASAR;
- Rincian PASAR always equals raw PASAR;
- Rincian ADUM always equals TB minus PASAR;
- the only non-zero correction COA in those periods is `62140001`;
- the correction varies by period and therefore must never be hard-coded.

A non-zero ADUM Delta requires an explicit effective `CC_ADUM` mapping/disposition for that COA.

## 5. Effective mapping rule

Stage E reads the existing Cost Structure mapping master but does not write to it.

Mapping identity is source-specific:

```text
CC_ADUM  -> use effective CC_ADUM mapping
CC_PASAR -> use effective CC_PASAR mapping
CC_DERIV -> use effective CC_PASAR mapping
ADUM Delta -> use effective CC_ADUM mapping
```

Effective date is the first calendar day of the selected fiscal period.

An effective mapping is applicable when:

```text
validFrom <= effectiveDate
AND (validTo IS NULL OR validTo >= effectiveDate)
AND active = true
```

Every non-zero analytical contribution must resolve to exactly one effective mapping/disposition.

Allowed dispositions:

```text
INCLUDE
EXCLUDE
RECLASS
```

Rules:

- `INCLUDE`: contributes to the mapped Nature.
- `EXCLUDE`: remains in reconciliation evidence but contributes zero to SI.
- `RECLASS`: contributes only to its explicit mapped target and must preserve the mapping action/reason in the snapshot.
- zero-only unmapped rows may be audit-visible but are not blocking.
- non-zero missing/ambiguous/invalid mapping is blocking.
- no amount may disappear silently.

Company 2000 mapping targets must remain within the source-locked Cost Group:

```text
CC_ADUM  -> ADUM
CC_PASAR -> PASAR
```

Nature target must be active and valid for mapped calculation.

## 6. DERIV treatment

`CC_DERIV` is already contained inside `CC_PASAR` and is never added to the TB control.

At SI stage it is a negative PASAR overlay.

For each non-zero DERIV COA:

1. verify the COA exists in `CC_PASAR` evidence;
2. resolve the effective `CC_PASAR` mapping;
3. preserve the raw positive DERIV amount as source evidence;
4. apply the SI contribution with negative sign only for INCLUDE/RECLASS mappings;
5. keep EXCLUDE derivative evidence excluded from both analytical contribution and final SI.

Formula:

```text
DERIV SI Offset
= - SUM(non-zero CC_DERIV amounts with contributing PASAR disposition)
```

No DERIV amount is double-counted.

## 7. SI calculation

### ADUM

```text
Mapped Raw ADUM
= SUM(CC_ADUM contributions with INCLUDE/RECLASS disposition)

Mapped Rincian ADUM Delta
= SUM(ADUM Delta contributions with INCLUDE/RECLASS disposition)

Final ADUM
= Mapped Raw ADUM + Mapped Rincian ADUM Delta
```

### PASAR

```text
Mapped Raw PASAR
= SUM(CC_PASAR contributions with INCLUDE/RECLASS disposition)

Final PASAR
= Mapped Raw PASAR + DERIV SI Offset
```

Because locked Rincian PASAR Delta is zero, Stage E must not invent a PASAR correction.

### Company

```text
Final Company SI = Final ADUM + Final PASAR
```

## 8. Mapping completeness controls

Stage E must persist/report at minimum by source family:

- non-zero COA count;
- mapped/include count and amount;
- excluded count and amount;
- reclassified count and amount;
- unmapped count and amount;
- ambiguous count and amount;
- invalid target count and amount.

Control identity:

```text
Validated non-zero source amount
=
Included amount
+ Excluded amount
+ Reclassified amount
```

for each base source family, with zero unaccounted amount.

Equivalent explicit controls are required for:

- Rincian ADUM Delta population;
- DERIV detail population.

## 9. Analytical row lineage

Stage E may populate `CostRawV2AnalyticalRow` only after mapping resolution.

Each row must retain enough immutable evidence to reproduce the result, including:

- calculationRunId;
- sourceRowId;
- source logical code;
- original sheet and source row number;
- COA;
- raw amount;
- signed mapped/contribution amount;
- analytical class;
- rule code;
- mapping status/action;
- mapping id or immutable mapping identity;
- Cost Group code/id;
- Nature code/id;
- mapping effective date;
- source/reference JSON containing related lineage where one analytical row depends on more than one raw row.

Recommended analytical classes/rules:

```text
BASE_CC_ADUM              / RAW_BASE_ADUM
BASE_CC_PASAR             / RAW_BASE_PASAR
RINCIAN_ADUM_DELTA        / RINCIAN_ADUM_RESIDUAL
DERIV_PASAR_OFFSET        / CC_DERIV_NEGATIVE_PASAR
EXCLUDED_EVIDENCE         / explicit mapping disposition
```

For a Rincian delta, the primary `sourceRowId` may point to the TB row, but the reference JSON must also identify the contributing CC_ADUM and CC_PASAR row ids/amounts used to derive the delta.

## 10. Persisted result controls

Stage E must persist authoritative server-side results, not rely on React aggregation.

Persist at minimum:

- Nature totals;
- ADUM total;
- PASAR total;
- Company total;
- mapping completeness controls;
- Rincian reconstruction controls;
- DERIV controls;
- final group roll-up controls.

Recommended result codes include:

```text
RINCIAN_ADUM_RECONCILIATION
RINCIAN_PASAR_RECONCILIATION
DERIV_MAPPING_RECONCILIATION
ADUM_NATURE_RECONCILIATION
PASAR_NATURE_RECONCILIATION
SI_ADUM_RECONCILIATION
SI_PASAR_RECONCILIATION
SI_COMPANY_RECONCILIATION
```

All blocking reconciliation differences must equal zero for Stage E SUCCESS.

## 11. Run lifecycle

Stage E creates a new isolated `CostRawV2CalculationRun`.

Eligibility:

- Company = 2000;
- active Raw V2 upload exists and is `VALIDATED`;
- required Stage C source controls pass;
- no unresolved Raw V2 ERROR issue;
- Stage D reconciliation exists for the same active upload;
- Stage D missing-in-TB count = 0;
- Stage D DERIV-in-PASAR missing count = 0.

Stage D `mismatchCount > 0` is not by itself a Stage E blocker because those differences are the explicit Rincian correction input.

On Stage E failure:

- persist safe diagnostics;
- mark new run `FAILED` and inactive;
- do not replace an existing active SUCCESS run;
- do not set the period to FINALIZED.

On Stage E success:

- all mapping/Rincian/DERIV/SI controls must pass;
- atomically deactivate the previous active Raw V2 SUCCESS run for the period;
- activate the new SUCCESS run;
- set only the Raw V2 period status to `CALCULATED`;
- never write `CostPeriod.activeCalculationRunId` or legacy result tables.

## 12. Mapping snapshot

`mappingSnapshotJson` must be deterministic and sufficient for audit/replay.

It must contain at minimum:

- effective date;
- exact effective mapping records used, including ids, source logical code, COA, mapping action, group, Nature, validFrom/validTo and update/version evidence;
- locked Rincian formula identity;
- locked DERIV formula identity;
- Stage D reconciliation/run identity used as input evidence;
- statement that no manual adjustment was applied in Stage E.

Do not calculate from live mapping after the snapshot is constructed within the run transaction.

## 13. August 2026 production acceptance gate

These values are acceptance evidence only and must not be hard-coded in production logic.

Raw V2 upload 2026/08 mapping coverage:

```text
CC_ADUM: 91 non-zero COAs
  INCLUDE 84
  EXCLUDE 7
  UNMAPPED 0
  AMBIGUOUS 0

CC_PASAR: 54 non-zero COAs
  INCLUDE 52
  EXCLUDE 2
  UNMAPPED 0
  AMBIGUOUS 0

CC_DERIV: 33 non-zero COAs
  PASAR INCLUDE 31
  PASAR EXCLUDE 2
  UNMAPPED 0
  AMBIGUOUS 0
```

Stage D evidence:

```text
Unique CC COAs       142
Found in TB          142
Missing in TB          0
Exact matches        141
Mismatch                1
COA 62140001 difference CC - TB = -3,802
```

Locked Rincian reconstruction for that COA:

```text
Raw ADUM       11,853,942
Raw PASAR      30,675,282
TB             42,533,026
Rincian PASAR  30,675,282
Rincian ADUM   11,857,744
ADUM Delta          +3,802
```

Expected Stage E SI parity:

```text
Mapped Raw ADUM        147,739,445,941
Rincian ADUM Delta               3,802
Final ADUM             147,739,449,743

Mapped Raw PASAR        15,538,582,759
Included DERIV Offset   -3,448,504,987
Final PASAR              12,090,077,772

Final Company SI        159,829,527,515
```

Per-Nature Raw V2 expected values must match the active legacy `ENGINE1_2000_V2` August 2026 Nature results exactly with zero difference.

## 14. API/UI

Keep all endpoints under `/api/cost-structure/raw-v2/...`.

Recommended endpoints:

```text
POST /api/cost-structure/raw-v2/si/calculate
GET  /api/cost-structure/raw-v2/si
```

POST requires Cost Structure PREPARE permission. GET requires READ permission.

Extend `/cost-structure/raw-v2` with:

- mapping coverage cards;
- Stage D mismatch/Rincian correction table;
- mapped/excluded amounts by source;
- DERIV include/exclude/offset summary;
- final ADUM/PASAR/Company SI;
- Nature breakdown;
- mapping/blocking issue table;
- source/mapping lineage drill-down.

For 2026/08 the UI must make clear that Stage D `-Rp3,802` becomes an explicit **+Rp3,802 Rincian ADUM correction**, not an invisible balancing entry.

## 15. Tests

Use synthetic fixtures only in committed tests.

Minimum tests:

- effective mapping date boundary;
- missing mapping on non-zero base amount blocks;
- ambiguous mapping blocks;
- EXCLUDE retained as evidence but contributes zero;
- RECLASS contributes only to explicit target;
- zero-only unmapped row does not block;
- Rincian PASAR = raw PASAR;
- Rincian ADUM = TB - PASAR;
- non-zero Stage D difference becomes exact ADUM Delta;
- missing TB blocks Rincian reconstruction;
- non-zero ADUM Delta requires effective ADUM disposition;
- DERIV uses PASAR mapping, never a separate DERIV mapping;
- DERIV is negative in SI and never double-counted;
- excluded DERIV does not reduce SI;
- mapping completeness balances exactly;
- Nature totals roll up to Cost Group totals;
- ADUM + PASAR = Company SI;
- failed Stage E run does not replace prior active SUCCESS;
- successful rerun becomes the sole active Raw V2 run;
- mapping snapshot is immutable/deterministic;
- no legacy transaction-table write;
- Decimal-only financial arithmetic.

Run:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npm test
npm run lint
npx tsc --noEmit
npm run build
```

## 16. Hard exclusions

Do not:

- change Stage C raw parsing semantics;
- erase or auto-resolve Stage D mismatch history;
- hard-code COA `62140001` as the only correction COA;
- hard-code August financial amounts in runtime code;
- use legacy audit Rincian or audit SI sheets as runtime dependencies;
- add DERIV to the TB raw reconciliation;
- silently map unknown COAs;
- silently convert errors to zero;
- write legacy calculation/result tables;
- implement Company 7000;
- implement export;
- implement finalization/reopen;
- implement Engine 2.
