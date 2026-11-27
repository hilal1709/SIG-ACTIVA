# Codex Prompts V2

Use one phase prompt at a time. Do not send all phases as one implementation request.

Every prompt assumes Codex first reads root `AGENTS.md` and all relevant documents under `docs/cost-structure-fluctuation/`.

---

## Prompt — Phase A: Repository integration foundation

```text
Implement Phase A only for the Cost Structure & Fluktuasi Biaya module in the existing SIG ACTIVA repository.

Read AGENTS.md and docs/cost-structure-fluctuation/* before editing.

Goals:
- Add the new parent menu `Cost Structure & Fluktuasi Biaya` while preserving the existing `Fluktuasi OI/EXP` menu.
- Add route shells for:
  /cost-structure
  /cost-structure/upload
  /cost-structure/monthly
  /cost-structure/periods
  /cost-fluctuation
- Establish separate API/domain namespaces but do not implement accounting calculation yet.
- Add module-specific authorization helper skeletons that reuse the current session/role system.
- Reuse existing Sidebar/Header/UI conventions.

Hard constraints:
- Do not alter app/fluktuasi-oi, app/overview-fluktuasi, app/detail-akun-fluktuasi or app/api/fluktuasi business behavior.
- Do not replace authentication.
- Do not add Supabase Auth/RLS.
- Do not implement Prisma Cost* schema yet unless minimal type-only scaffolding is unavoidable.
- Do not implement upload/parser/calculation/dashboard business logic.

Run lint/build and report changed files plus any pre-existing failures.
```

---

## Prompt — Phase B: Prisma core schema and master data

```text
Implement Phase B only.

Read AGENTS.md, DATA_MODEL.md, BUSINESS_RULES.md and SECURITY.md.

Create additive Prisma models/migrations for the Cost Structure domain using `Cost*` models. Do not modify/drop legacy Fluktuasi*, Accrual, Prepaid, Material or User models.

Required core models:
CostCompany, CostGroup, CostNature, CostCoa, CostCoaMapping, CostPeriod, CostUpload, CostSourceRow, CostValidationIssue, CostAdjustment, CostCalculationRun, CostActualLine, CostCalculationResult, CostAuditLog.

Use Prisma Decimal/PostgreSQL numeric for all monetary values. Do not use Float for new financial fields.

Seed idempotently:
2000 -> ADUM, PASAR
7000 -> HPP, ADUM, PASAR
No Derivatif.

Add relevant indexes/constraints.

Do not implement Engine 1 formulas yet.

Run Prisma validation/generation, migration checks, lint/build and relevant tests.
```

---

## Prompt — Phase C: Upload form and parser framework

```text
Implement Phase C only.

Read SOURCE_DATA_SPEC.md, ARCHITECTURE.md, SECURITY.md and TEST_CASES.md.

Build the Upload & Proses workflow for one workbook per company/fiscal period.

Form fields:
- Company Code
- Fiscal Year
- Fiscal Period
- Upload Note optional
- Source Workbook

There is no META worksheet.

Implement:
- file validation;
- SHA-256 hashing;
- versioned CostUpload records;
- durable storage abstraction/provider integration approved for this repo;
- logical source-sheet detection;
- parser interfaces;
- normalized CostSourceRow staging data;
- CostValidationIssue creation;
- metadata cross-check when source itself exposes reliable period/company metadata.

Do not implement accounting calculations or final Cost Structure.
Do not rely on external Excel links or server recalculation of workbook formulas.
Do not touch existing Fluktuasi OI/EXP parser/API behavior.

Add parser/source tests, then run lint/build/tests.
```

---

## Prompt — Phase D: Source reconciliation and mapping

```text
Implement Phase D only.

Read BUSINESS_RULES.md, SOURCE_DATA_SPEC.md, DATA_MODEL.md and TEST_CASES.md.

Implement source controls and mapping workflow:
- extract reported CC Group total from each applicable source parser;
- calculate detail COA total;
- require difference = 0;
- expose reconciliation status/issues;
- resolve COA using effective-dated CostCoaMapping;
- unknown non-zero COA becomes UNMAPPED, never zero;
- support explicit exclusion/reclassification with reason;
- enforce mapped + excluded + reclassified = validated source.

Build the required operational UI for reconciliation and mapping resolution.

Do not implement 2000/7000 final Cost Structure formulas yet.

Add tests for exact reconciliation, Rp1 mismatch, subtotal double counting, mapping changes and exclusions.
Run lint/build/tests.
```

---

## Prompt — Phase E: Engine 1 company 2000

```text
Implement Engine 1 for company 2000 only.

Read CALCULATION_RULES.md, BUSINESS_RULES.md and TEST_CASES.md.

Scope:
- ADUM
- PASAR
- No HPP
- No Derivatif

Translate the validated existing company-2000 workbook logic into deterministic server-side domain functions.

Implement:
- calculation run versioning;
- mapped/allocation/reclassification logic required by the reference workbook;
- CostActualLine and CostCalculationResult output;
- Nature -> COA lineage;
- ADUM/PASAR reconciliation;
- idempotent rerun behavior;
- calculation review endpoint/UI sufficient for testing.

Before declaring completion, create golden fixtures/expected values from the supplied validated 2000 workbook and prove the agreed Cost Structure totals match exactly.

If golden results do not match, stop at diagnosis and do not implement company 7000.

Run lint/build/tests and include golden reconciliation evidence.
```

---

## Prompt — Phase F: Engine 1 company 7000

```text
Implement Engine 1 for company 7000 only after company-2000 golden tests pass.

Read CALCULATION_RULES.md, BUSINESS_RULES.md, SOURCE_DATA_SPEC.md and TEST_CASES.md.

Scope:
- HPP
- ADUM
- PASAR
- No Derivatif

Implement dedicated tested rule functions for:
- HPP_TOTAL_7000
- COAL_7000_EXISTING
- OA_7000_EXISTING
- HPP_INVENTORY_DIFF_7000
plus validated existing mapping/allocation logic required by the golden workbook.

Locked formulas:
Total HPP = total account-group-5 cost - account-group-5 COGS Mortar.
Selisih Persediaan = Total HPP - subtotal all HPP natures before Selisih Persediaan.
Sum all HPP natures must equal Total HPP exactly.
OA remains under PASAR.

Do not hard-code Excel row numbers. Use explicit account/rule mappings.
Do not depend on external workbook links at runtime.

Create golden tests from the validated 7000 workbook for HPP/ADUM/PASAR and special formula components.
Do not continue if HPP reconciliation or golden output differs.

Run lint/build/tests and report exact reconciliation evidence.
```

---

## Prompt — Phase G: Engine 1 finalization, dashboard and export

```text
Implement Phase G after both Engine 1 golden gates pass.

Read UI_FLOW.md, CALCULATION_RULES.md and SECURITY.md.

Implement:
- period readiness service;
- FINALIZED state;
- immutable normal behavior after finalization;
- controlled reopen with mandatory reason and audit log;
- Dashboard Cost Structure;
- Cost Structure Bulanan detail/drill-down;
- Riwayat Periode;
- calculation/source lineage display;
- server-side Excel export using exceljs.

Export must be generated from finalized database results, not by copying the uploaded workbook.

2000 export: Summary, ADUM, PASAR, COA Detail, Reconciliation, Source Trace.
7000 export: same plus HPP.

All dashboard/export totals must match the active finalized calculation run.
Run regression tests for existing SIG ACTIVA modules.
```

---

## Prompt — Phase H: Engine 2 comparison engine

```text
Implement Phase H only.

Engine 2 must query only FINALIZED Engine 1 historical results.

Implement server-side:
- MoM
- YoY
- YTD
- variance amount
- variance percent
- contribution

Rules:
- Jan MoM compares to Dec prior year.
- YoY compares same month prior year.
- YTD compares Jan-current month against same range prior year.
- Missing historical period is not zero; return comparison-unavailable/incomplete state.
- Zero comparison with non-zero current returns variancePercent null/status NM.
- Use finalized active calculation run only.

Support Company -> Cost Group -> Nature -> COA aggregation/drill-down.

Do not implement commentary/dashboard polish yet beyond service verification.
Add calculation tests and run lint/build/tests.
```

---

## Prompt — Phase I: Materiality, commentary and review

```text
Implement Phase I only.

Add/complete:
- CostMaterialityRule
- CostCommentary
- CostCommentaryHistory
- CostPeriodReview

Implement materiality evaluation and commentary workflow:
OPEN -> DRAFT -> SUBMITTED -> REVIEWED
and SUBMITTED -> RETURNED -> DRAFT.

Keep separate commentary for MOM, YOY and YTD.
Commentary must never alter calculated amounts.

Use module-specific server authorization:
- prepare/write: ADMIN_SYSTEM, STAFF_ACCOUNTING
- review/finalize: ADMIN_SYSTEM, SUPERVISOR_ACCOUNTING
- admin: ADMIN_SYSTEM

Preserve maker/checker history and audit events.
Add authorization/workflow tests.
```

---

## Prompt — Phase J: Fluctuation dashboard and export

```text
Implement Phase J after Engine 2 and commentary tests pass.

Build the Fluctuation dashboard using existing SIG ACTIVA visual components/patterns.

Filters:
Company, Period, MoM/YoY/YTD, Cost Group, Nature/COA view.

Show:
- current cost;
- variance amount/%;
- top increases/decreases;
- contribution drivers;
- trend;
- material variance count;
- explained/outstanding commentary;
- detailed analysis table;
- waterfall if it adds value without compromising clarity.

Implement server-generated Excel export:
Executive Summary, MoM, YoY, YTD, HPP Detail when applicable, ADUM Detail, PASAR Detail, Commentary.

Handle comparison unavailable and N/M states correctly.
Sanitize text cells against spreadsheet formula injection.
Run lint/build/tests/regression checks.
```

---

## Prompt — Phase K: Hardening and deployment

```text
Implement Phase K hardening only; do not add new business scope.

Run and fix:
- authorization negative tests;
- upload size/abuse checks;
- parser edge cases;
- database transaction consistency;
- audit completeness;
- export formula-injection tests;
- realistic workbook performance tests;
- durable storage production validation;
- golden financial suite;
- existing SIG ACTIVA regression suite.

Confirm no destructive legacy migrations and no behavior regression in Fluktuasi OI/EXP, Accrual, Prepaid, Material, auth, User Management or Security Status.

Document deployment/migration sequence and rollback precautions.
Run final production build and report remaining risks explicitly.
```
