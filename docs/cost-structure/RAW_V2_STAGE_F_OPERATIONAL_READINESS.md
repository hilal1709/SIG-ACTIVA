# Raw SAP Engine 1 V2 — Stage F Operational Readiness (Company 2000)

## 1. Scope

Stage F makes the already validated Company 2000 Raw V2 calculation usable as an operational reporting workflow.

Stage F is a reporting, review, drill-down, history, export, and UX phase. It does **not** introduce a new financial calculation rule.

Authoritative calculation remains Stage E under:

```text
ENGINE1_2000_RAW_V3
```

Stage F may read persisted Raw V2 data only. It must not recalculate SI in React or invent alternative totals.

Stage F includes:

1. operational dashboard for Company 2000;
2. workflow/status presentation from active upload through Stage D and active Stage E SUCCESS;
3. Nature-to-COA analytical drill-down and immutable lineage visibility;
4. mapping coverage and blocking diagnostics;
5. calculation run history;
6. server-side Excel export for an eligible active Stage E SUCCESS result;
7. operational UX improvements around Load, reconciliation, mapped SI, history, and export.

Stage F excludes Company 7000, Engine 2/fluctuation, period finalization/reopen, manual adjustment workflow, legacy engine cutover/removal, and any change to Stage C/D/E financial semantics.

## 2. Locked Stage E baseline

Stage F must preserve the validated accounting logic exactly:

```text
Rincian PASAR = Raw PASAR
Rincian ADUM  = TB - Raw PASAR
ADUM Delta    = TB - Raw ADUM - Raw PASAR

Final ADUM  = mapped Raw ADUM + mapped ADUM Delta
Final PASAR = mapped Raw PASAR - contributing mapped CC_DERIV
Final SI    = Final ADUM + Final PASAR
```

`CC_DERIV` remains contained inside `CC_PASAR`, is not additive to the Stage D TB equality, and is applied only as the Stage E negative PASAR overlay for INCLUDE/RECLASS dispositions.

No Stage F code may alter Stage E persisted results.

## 3. Production acceptance baseline

The validated August 2026 Company 2000 production run is acceptance evidence only and must not be hard-coded in runtime code.

Active Stage E acceptance evidence:

```text
Fiscal year / period : 2026 / 08
Active upload         : 2
Active Stage E run    : 5
Status                : SUCCESS
Ruleset               : ENGINE1_2000_RAW_V3
Analytical rows       : 238
Result rows           : 18
Controls              : 12
Failed controls       : 0

Final ADUM            : 147,739,449,743
Final PASAR           : 12,090,077,772
Final Company SI      : 159,829,527,515

Rincian ADUM Delta    : +3,802
DERIV raw             : 3,460,258,896
DERIV contributing    : 3,448,504,987
DERIV excluded        : 11,753,909
DERIV SI offset       : -3,448,504,987
```

Parity evidence versus active legacy `ENGINE1_2000_V2` August 2026:

```text
Nature rows compared  : 15
Exact matches         : 15
Mismatch              : 0
Absolute difference   : 0
```

Stage F output and export must reproduce these persisted values exactly when 2026/08 is selected.

## 4. Operational source of truth

For a selected Company 2000 fiscal period, Stage F must determine the current operational result using this chain:

```text
active Raw V2 upload
-> latest Stage D reconciliation for that same active upload
-> active Stage E SUCCESS run for that same active upload
```

The main dashboard and export must never silently show a Stage E result belonging to a superseded upload.

Failed/inactive historical runs remain visible only in run history and diagnostics.

An invalidated historical run must never be presented as current operational truth.

## 5. Dashboard requirements

The existing Raw V2 page should become a clear operational workspace rather than a developer-style reconciliation screen.

At minimum present:

### 5.1 Period selector and workflow state

Display Company, fiscal year, fiscal period, active upload version/status, current ruleset and period status.

Display an explicit workflow stepper/status sequence:

```text
1. Raw upload
2. Source validation
3. TB ↔ Base CC reconciliation
4. Mapping / Rincian / SI
5. Reporting / Export
```

Each step must visibly show status such as READY, PASS, FAIL, SUCCESS, NOT RUN, or BLOCKED as applicable.

Stage D FAIL caused only by explicit Rincian residual remains diagnostic and must not be visually misrepresented as a failed Stage E result.

### 5.2 Executive result cards

For an eligible active Stage E SUCCESS, show at minimum:

- Final ADUM;
- Final PASAR;
- Final Company SI;
- Stage D CC − TB difference;
- Rincian ADUM correction;
- DERIV raw;
- DERIV contributing/include amount;
- DERIV excluded amount;
- DERIV SI offset.

All values must come from persisted Raw V2 result/control/analytical data, not browser-side financial recomputation.

### 5.3 Mapping coverage

For each of:

```text
CC_ADUM
CC_PASAR
RINCIAN_ADUM_DELTA
CC_DERIV
```

show:

- non-zero count;
- INCLUDE count/amount;
- EXCLUDE count/amount;
- RECLASS count/amount;
- UNMAPPED count/amount;
- AMBIGUOUS count/amount;
- INVALID TARGET count/amount;
- completeness difference/status.

### 5.4 Nature breakdown

Show persisted Nature results grouped by ADUM and PASAR.

Nature totals must roll up exactly to the persisted Cost Group totals.

The UI may sort/filter/display, but must not calculate an alternative authoritative Nature total.

### 5.5 COA / analytical lineage drill-down

Provide searchable/filterable analytical rows with at minimum:

- logical source;
- original sheet;
- source row number;
- COA;
- description;
- raw amount;
- signed mapped/SI contribution;
- analytical class;
- mapping status/action;
- Cost Group;
- Nature;
- rule code;
- mapping id/effective date;
- source/reference lineage JSON in a readable expandable representation.

Filters should support at minimum COA text, source family, Cost Group, Nature, mapping status/action, and analytical class.

A Rincian delta row must visibly expose its TB, ADUM, and PASAR source row references.

A DERIV row must visibly show the original DERIV source evidence and negative SI contribution.

### 5.6 Blocking/diagnostic issues

Show unresolved mapping/calculation issues and failed controls for the selected operational run.

For a SUCCESS run, zero blocking issues should be explicit rather than silently omitted.

## 6. Run history

Stage F must expose Raw V2 calculation history for the selected period.

At minimum show:

- run number/id;
- stage identity from snapshot;
- upload id/version where available;
- status;
- active/inactive state;
- ruleset;
- started/completed timestamps;
- error/invalidation message;
- result/control/analytical row counts where relevant.

History must retain failed Stage D diagnostic runs and invalidated Stage E runs.

The active Stage E SUCCESS should be visually distinct.

Do not delete or rewrite historical runs in Stage F.

## 7. Excel export

Stage F may enable Raw V2 export for Company 2000 only when all eligibility rules pass.

Recommended endpoint:

```text
GET /api/cost-structure/raw-v2/report/export?fiscalYear=YYYY&fiscalPeriod=P
```

Export requires Cost Structure READ permission.

### 7.1 Export eligibility

Export is allowed only if:

- Company = 2000;
- active Raw V2 upload exists;
- an active Stage E SUCCESS run exists for the same active upload;
- the run uses `ENGINE1_2000_RAW_V3`;
- all persisted Stage E controls for that run are PASS;
- Company result and Cost Group results are present;
- at least one analytical row exists;
- at least one Nature result exists.

Fail closed on any missing/inconsistent population. Do not export zero/empty SUCCESS-like workbooks.

### 7.2 Export generation

Generate the workbook server-side from persisted Raw V2 records. Existing `exceljs` may be used.

Do not calculate authoritative totals in the client.

Suggested filename:

```text
SIG-ACTIVA_Raw-V2_2000_YYYY-P##_Run-<runNumber>.xlsx
```

### 7.3 Required sheets

Workbook must contain at minimum:

1. `Summary`
2. `Nature`
3. `Mapping Coverage`
4. `Controls`
5. `Analytical Lineage`
6. `Run History`

#### Summary

Include:

- Company;
- fiscal year/period;
- active upload id/version;
- active Stage E run id/number;
- ruleset;
- run/period status;
- Final ADUM;
- Final PASAR;
- Final Company SI;
- Stage D difference;
- Rincian ADUM Delta;
- DERIV raw/include/exclude/offset;
- generated timestamp.

#### Nature

Include Cost Group, Nature code, Nature name if available, amount, run id and ruleset.

#### Mapping Coverage

Include each population's counts and amounts by INCLUDE/EXCLUDE/RECLASS/UNMAPPED/AMBIGUOUS/INVALID TARGET plus source/accounted/difference/status.

#### Controls

Include all persisted Stage E controls, amounts, differences, status and metrics/evidence.

#### Analytical Lineage

Include the lineage fields listed in section 5.5.

#### Run History

Include selected-period Raw V2 runs including failed/inactive/invalidated history.

### 7.4 Excel financial integrity

Money cells should be numeric Excel cells with full IDR precision, not formatted text values.

No binary floating-point calculation may be used to produce financial amounts. Convert persisted Decimal strings safely into Excel numeric representation only for presentation/output.

The export should also include string/exact-value evidence where needed to preserve auditability for large values.

## 8. API/read model

Stage F may extend existing Stage E GET or introduce a dedicated read endpoint, for example:

```text
GET /api/cost-structure/raw-v2/report?fiscalYear=YYYY&fiscalPeriod=P
GET /api/cost-structure/raw-v2/report/export?fiscalYear=YYYY&fiscalPeriod=P
```

The reporting read model should return a coherent server-side payload for the selected active upload and active Stage E SUCCESS, including:

- period/upload status;
- Stage D summary;
- Stage E results;
- controls;
- analytical rows;
- run history;
- export eligibility.

READ permission is required.

Avoid client-side joins that could mix different upload/run identities.

## 9. Capability state

When Stage F implementation is fully wired and protected:

```text
RAW_V2_PHASE = F_OPERATIONAL_READINESS
uploadEnabled = true
calculationEnabled = true
exportEnabled = true
```

Do not set `exportEnabled=true` unless the server-side export route is complete, authenticated, active-upload scoped and fail-closed.

## 10. Persistence and migration

Stage F should prefer the existing Stage E persisted schema.

No new database migration is expected unless a concrete operational requirement cannot be met from existing persisted data.

If Codex determines a migration is necessary, it must stop and explain the requirement in the PR instead of adding production DDL by assumption.

No production migration may be executed as part of the Stage F coding task.

## 11. Security and isolation

All Stage F routes remain under `/api/cost-structure/raw-v2/...`.

READ permission protects reporting/history/export reads.

PREPARE remains required for Stage D/Stage E calculation actions already implemented.

Stage F must not write:

- legacy `CostPeriod`;
- legacy `CostCalculationRun`;
- legacy `CostCalculationResult`;
- legacy activeCalculationRunId;
- legacy audit source tables.

Legacy Engine 1 remains operational and untouched.

## 12. Operational UX

The page should guide a finance user through normal monthly use without requiring knowledge of internal implementation stages.

Prefer user-facing labels such as:

```text
Upload & Validation
Reconciliation
Mapped Cost Structure / SI
Result & Export
Run History
```

Internal stage codes may appear as secondary audit metadata.

Keep financial exceptions prominent and auditable.

Do not hide a failed control behind a generic SUCCESS badge.

## 13. Tests

Use synthetic fixtures only in committed tests.

Minimum tests:

- report GET scopes all current data to the active upload;
- active Stage E SUCCESS is selected, not latest failed/inactive run;
- superseded-upload Stage E result is not operationally visible;
- invalidated zero-value run is history only and never export eligible;
- export rejects missing active SUCCESS;
- export rejects failed controls;
- export rejects zero analytical population;
- export rejects missing Nature population;
- export contains all required sheets;
- Summary totals equal persisted results;
- Nature export equals persisted Nature results;
- Mapping Coverage and Controls come from persisted controls;
- Analytical Lineage retains source row/mapping/rule/reference evidence;
- Run History includes failed/inactive history;
- export route requires READ permission;
- no legacy transaction-table write;
- no Stage E financial formulas are changed;
- `exportEnabled=true` only when export implementation exists.

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

## 14. Hard exclusions

Do not:

- change Stage C parser semantics;
- change Stage D reconciliation semantics;
- change Stage E mapping/Rincian/DERIV/SI formulas;
- recalculate authoritative totals in React;
- export results from a superseded upload;
- export a failed/inactive Stage E run as current truth;
- silently suppress failed controls;
- delete historical failed/invalidated runs;
- implement Company 7000;
- implement Engine 2/fluctuation;
- implement finalization/reopen;
- implement manual adjustment workflow;
- remove or disable legacy Engine 1;
- apply production migrations;
- hard-code August 2026 amounts or run ids in runtime code.
