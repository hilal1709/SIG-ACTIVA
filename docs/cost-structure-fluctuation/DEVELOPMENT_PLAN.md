# Development Plan V2 — SIG ACTIVA Module

## Development strategy

This is an additive module inside the existing SIG ACTIVA repository. There is no standalone application bootstrap phase.

Every phase must preserve existing features and respect the golden accounting gates.

## Phase A — Repository integration foundation

### Scope

- read all module documents and `AGENTS.md`;
- add the new parent Sidebar menu and empty route shells only;
- define module folder/API namespace;
- add module-specific authorization helper skeletons;
- add test scaffolding appropriate to repository conventions;
- no business database migration yet unless needed only for harmless scaffolding.

### Suggested routes

```text
/cost-structure
/cost-structure/upload
/cost-structure/monthly
/cost-structure/periods
/cost-fluctuation
```

### Acceptance

- existing routes still work;
- new pages require valid session;
- no changes to existing Fluktuasi OI/EXP behavior;
- lint/build pass.

## Phase B — Prisma core schema and master data

### Scope

Add new `Cost*` models for:

```text
CostCompany
CostGroup
CostNature
CostCoa
CostCoaMapping
CostPeriod
CostUpload
CostSourceRow
CostValidationIssue
CostAdjustment
CostCalculationRun
CostActualLine
CostCalculationResult
CostAuditLog
```

Commentary/materiality models can be added now or in Engine 2 phase if migration separation is cleaner.

Seed:

```text
2000 → ADUM, PASAR
7000 → HPP, ADUM, PASAR
```

Use Decimal/numeric for all new money fields.

### Acceptance

- migration is additive;
- no legacy table changed/dropped;
- seed is idempotent;
- module master queries work;
- existing application builds and starts.

## Phase C — Upload form, durable file handling and source parser framework

### Scope

Build Upload & Proses screen with form metadata:

```text
Company
Fiscal Year
Fiscal Period
Upload Note optional
Workbook
```

No META sheet.

Implement:

- file validation/hash/versioning;
- durable storage adapter/provider decision;
- workbook logical-source detection;
- normalized staging rows;
- parser framework;
- validation issue register.

### Acceptance

- one workbook can be uploaded per company/period;
- duplicate/replacement behavior is controlled;
- required logical sources are detected;
- metadata cross-check works where source metadata exists;
- raw/normalized lineage is queryable;
- no accounting calculation yet.

## Phase D — Source reconciliation and mapping workflow

### Scope

Implement:

- CC Group reported-total extraction;
- detail COA sum control;
- source reconciliation UI;
- COA master/mapping resolution;
- effective-dated mapping;
- explicit exclusion/reclassification disposition;
- mapping completeness control.

### Acceptance

For every required CC Group:

```text
sum detail COA = reported source total
```

and:

```text
mapped + excluded + reclassified = validated source
```

must be provable.

Unmapped non-zero amounts block calculation.

## Phase E — Engine 1 company 2000

### Scope

Implement company 2000 monthly Cost Structure:

```text
ADUM
PASAR
```

Translate validated existing workbook mapping/allocation logic into deterministic server domain functions.

Implement:

- calculation run versioning;
- Nature/COA roll-up;
- ADUM/PASAR reconciliation;
- calculation lineage;
- provisional result review.

### Golden gate

Run company 2000 golden workbook/reference month.

System must match verified existing output exactly for agreed target totals.

### Acceptance

- golden test passes;
- rerun is idempotent;
- reconciliation difference = 0;
- Derivatif absent;
- do not proceed to company 7000 until gate passes.

## Phase F — Engine 1 company 7000

### Scope

Add:

```text
HPP
ADUM
PASAR
```

Implement validated formula functions:

```text
HPP_TOTAL_7000
COAL_7000_EXISTING
OA_7000_EXISTING
HPP_INVENTORY_DIFF_7000
```

and all required existing 7000 allocations/reclassifications.

### Locked formula

```text
Total HPP
= Account Group 5 Total
- Account-group-5 COGS Mortar
```

```text
Selisih Persediaan
= Total HPP
- subtotal all HPP natures before Selisih Persediaan
```

### Golden gate

Run company 7000 golden workbook/reference month.

Expected special components and final HPP/ADUM/PASAR must match verified existing output.

HPP reconciliation difference must equal zero.

### Acceptance

- all 7000 golden tests pass;
- OA remains under PASAR;
- no Derivatif;
- no Excel external-link dependency at runtime.

## Phase G — Engine 1 finalization, dashboard and Excel export

### Scope

Implement:

- readiness/finalization service;
- final Cost Structure history;
- Dashboard Cost Structure;
- Cost Structure Bulanan detail;
- lineage drawer/page;
- period history;
- controlled reopen;
- Excel export using `exceljs`.

### Acceptance

- only reconciled period can finalize;
- finalized values are immutable through normal APIs;
- dashboard totals match database final run;
- export totals match finalized database values;
- company 2000 export excludes HPP;
- company 7000 export includes HPP.

## Phase H — Engine 2 comparison engine

### Scope

Implement server services for:

```text
MoM
YoY
YTD
Variance Amount
Variance %
Contribution
```

Input must be finalized Engine 1 historical results only.

### Acceptance

- January rollover works;
- missing history is not zero;
- zero denominator is N/M;
- YTD incomplete-history behavior is explicit;
- Company/Group/Nature/COA drill-down aggregates correctly.

## Phase I — Materiality, commentary and review

### Scope

Add/activate models and UI for:

```text
CostMaterialityRule
CostCommentary
CostCommentaryHistory
CostPeriodReview
```

Implement:

- materiality evaluation;
- separate MoM/YoY/YTD commentary;
- draft/submit/return/review;
- maker/checker controls;
- audit trail.

### Acceptance

- required explanation generated from materiality status;
- commentary never alters amount;
- authorization enforced server-side;
- history preserved.

## Phase J — Fluctuation dashboard and Excel export

### Scope

Build:

- Fluctuation KPI dashboard;
- top increases/decreases;
- contribution view;
- trend;
- waterfall if suitable;
- commentary progress;
- detailed analysis table;
- Engine 2 Excel export.

### Acceptance

- all dashboard values match Engine 2 service output;
- export includes MoM/YoY/YTD and commentary;
- missing/NM states render correctly;
- existing SIG ACTIVA visual language is preserved.

## Phase K — Security, performance and regression hardening

### Scope

- authorization negative tests;
- upload abuse limits;
- formula-injection export tests;
- DB transaction checks;
- audit coverage;
- parser/performance tests on realistic large workbooks;
- production storage verification;
- full existing-feature regression;
- migration/deployment runbook.

### Acceptance

- financial golden suite passes;
- module authorization suite passes;
- existing SIG ACTIVA regression checklist passes;
- production build passes;
- no destructive legacy schema change;
- production deploy plan documented.

## Dependency gates

```text
A Repository integration
↓
B Prisma core
↓
C Upload/parser
↓
D Source reconciliation/mapping
↓
E Engine 1 — 2000
↓
*** 2000 GOLDEN GATE ***
↓
F Engine 1 — 7000
↓
*** 7000 GOLDEN GATE ***
↓
G Engine 1 dashboard/export/finalization
↓
H Engine 2 comparison
↓
I Commentary/review
↓
J Engine 2 dashboard/export
↓
K Hardening/deployment
```

## Definition of MVP complete

### Company 2000

```text
Upload one source workbook
→ source controls reconcile
→ mappings complete
→ Cost Structure ADUM/PASAR matches golden workbook
→ finalize
→ Cost Structure dashboard/export
→ MoM/YoY/YTD from finalized history
→ commentary/review
→ Fluctuation dashboard/export
```

### Company 7000

```text
Upload one source workbook
→ source controls reconcile
→ HPP/ADUM/PASAR calculation matches golden workbook
→ Total HPP formula passes
→ Selisih Persediaan formula passes
→ HPP reconciliation = 0
→ finalize
→ Cost Structure dashboard/export
→ Engine 2 analysis/commentary/dashboard/export
```

## What must not be implemented opportunistically

Unless separately approved, do not add during MVP phases:

- SAP direct API integration;
- budget/forecast;
- AI accounting calculation;
- auto journal;
- Derivatif;
- rewrite of existing Fluktuasi OI/EXP;
- unrelated refactor of Accrual/Prepaid/Material modules.
