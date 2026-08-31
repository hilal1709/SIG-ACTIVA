# Project Status — Cost Structure & Fluktuasi Biaya

Last updated: 2026-08-31

## Overall status

```text
Phase A — Repository integration foundation       COMPLETE
Phase B — Core schema & master data               COMPLETE / production DDL applied
Phase C — Upload/parser/storage                    COMPLETE
Phase D — Source reconciliation/mapping            COMPLETE
Phase E — Engine 1 Company 2000                    COMPLETE / PRODUCTION GOLDEN E2E PASS
Phase F — Engine 1 Company 7000                    COMPLETE / PRODUCTION GOLDEN E2E PASS
Phase G — Finalization/dashboard/export            COMPLETE / PRODUCTION UAT PASS
Phase H — Engine 2 comparison                      IMPLEMENTED / REVIEW
Phase I — Materiality/commentary/review             NOT STARTED
Phase J — Fluctuation dashboard/export              NOT STARTED
Phase K — Hardening/deployment                     NOT STARTED
```

## Architecture and production policy

Runtime remains:

```text
Next.js / API
  → Prisma Client
  → @prisma/adapter-pg + pg
  → DATABASE_URL
  → Supabase PostgreSQL
```

Production DDL is controlled through reviewed Supabase migrations. Never run production `prisma migrate deploy`, `prisma migrate reset`, or `prisma db push`. Private workbooks and secrets never enter GitHub.

## Phases A–D — complete foundation

Production-proven capabilities:

- Cost Structure navigation/auth and legacy isolation;
- private Supabase Storage upload with SHA-256/version lineage;
- SheetJS source parsing, normalized `CostSourceRow`, validation register;
- source CC reconciliation;
- effective-dated source-specific COA mapping;
- INCLUDE / EXCLUDE / RECLASS;
- non-zero unmapped blocking, zero unmapped non-blocking;
- `SOURCE_RECONCILED` readiness gate.

## Phase E — Company 2000 — COMPLETE

Production July-2026 golden E2E:

```text
ADUM   107,796,550,061.00
PASAR   17,900,551,142.00
TOTAL  125,697,101,203.00
```

Company 2000 remains the regression baseline.

## Phase F — Company 7000 — COMPLETE

The real private workbook `TB 7000 07-2026 (Derivatif).xlsx` passed the deployed application flow:

```text
Upload → Validation → Source Reconciliation → Mapping → Calculation
```

Production active run:

```text
Run Number          7
Run DB ID           8
Status              SUCCESS
Active              true
Rule Set            ENGINE1_7000_V1
Actual Lines        211
Period Status       FINALIZED
Bad Controls        0
```

Exact production golden:

```text
HPP                413,169,722,810.00
ADUM                11,667,383,975.00
PASAR regular        9,572,860,045.00
OA                   72,068,727,025.00
PASAR total          81,641,587,070.00
TOTAL COMPANY       506,478,693,855.00
```

All HPP Nature H01–H16 match the golden workbook exactly, including:

```text
Batubara             93,152,232,023.32
Batubara Inbound     41,023,853,211.68
Pembelian Terak                       0.00
Selisih Persediaan  -21,153,010,152.00
```

Controls:

```text
HPP_NATURE_RECONCILIATION    RECONCILED / 0.00
ADUM_NATURE_RECONCILIATION   RECONCILED / 0.00
PASAR_NATURE_RECONCILIATION  RECONCILED / 0.00
```

### Verified Company 7000 source rules

- Total HPP = TB account group 5 minus COGS Mortar COA `51300003`;
- HPP base allocation follows validated TB/ADUM/final-PASAR/Derivative exclusion lineage;
- OA uses controlled GL `68110001`, `68140005`, `68140006`, `68170002` and persisted OA_STAT transaction/summary lineage;
- Derivative `68140005 / 368,191,098` has zero Cost Structure contribution;
- Batubara = `Batu bara!H10 + H18`;
- Batubara Inbound = `Batu bara!I10 + I18`;
- WHRPG primary 6xxxxxxx is deterministically reclassified; 97xxxxxx is excluded;
- Solar `112-200001 / 7702` is support lineage only, not double-counted;
- Pembelian Terak follows `SUM(beli!F63:F69)` with seven required rows and Excel blank-as-zero cell semantics;
- authoritative finance precision remains `Decimal(20,2)`.

Twelve non-zero TB-derived HPP rows whose `Klasifikasi HPP` is blank in the real `rincian biaya` were traced to the final `GHoPO`/SI formula. They are intentionally outside direct H01–H15 SUMIF classification and therefore affect H16 only through the final HPP residual; this is an SI-traced rule, not a generic missing-mapping fallback.

## Phase G — COMPLETE / PRODUCTION UAT PASS

Phase G uses the strict persisted read path:

```text
CostPeriod
→ active successful CostCalculationRun
→ CostCalculationResult
→ CostActualLine / persisted lineage
→ CostSourceRow / audit-only snapshots
```

Dashboard and export do not run Engine 1, mapping resolution, reconciliation, or source workbook formulas when opened.

Lifecycle:

```text
CALCULATED → COST_STRUCTURE_RECONCILED → FINALIZED
```

Finalization revalidates the same active run and all required persisted controls/totals inside the finalization transaction. Reopen is reason-required and audited.

### Production UAT evidence — July 2026

Company 2000:

```text
Period ID           1
Status              FINALIZED
Active Run          1 / ENGINE1_2000_V1 / SUCCESS
Audit Snapshot      READY
Audit Rows          501
Audit Sources       AUDIT_SI, AUDIT_RINCIAN, AUDIT_CC_DRV
```

Company 7000:

```text
Period ID           2
Status              FINALIZED
Active Run          8 / Run #7 / ENGINE1_7000_V1 / SUCCESS
Audit Snapshot      READY
Audit Rows          572
Audit Sources       AUDIT_GHOPO, AUDIT_DERIV, AUDIT_RINCIAN,
                    AUDIT_CC_DRV, AUDIT_SI2000_DRV
```

Production audit log confirms, for both golden periods:

```text
HYDRATE_AUDIT_SOURCE
EXPORT_COST_STRUCTURE
RECONCILE_COST_STRUCTURE
FINALIZE_COST_STRUCTURE
```

The export audit entry explicitly records that workbook rendering uses persisted calculation/source lineage with no accounting recalculation or Storage read at export time.

### Official Company 7000 Excel contract

```text
GHoPO
DERIV
rincian biaya
tb
cc_prod
cc_adm
cc pasar
cc_drv
SI2000_DRV
WHRPG
Batu bara
statistical pasar
beli
solar PP order
Formula Audit
```

`GHoPO`, `DERIV`, `rincian biaya`, `cc_drv`, and `SI2000_DRV` are audit-only source snapshots. Audit-only derivative data has zero Engine 1 contribution. `GHoPO` authoritative cells are rendered from persisted calculation results; `Formula Audit` is rendered from persisted lineage. Export is DB-only and does not download/reparse Storage XLSX at request time.

### Deferred presentation polish

The financial data/content of the production export has been accepted for Phase G. Further improvement of workbook formatting/style is intentionally deferred and is **not a blocker for Phase H**. Visual polish may be completed later as a dedicated export/UI refinement, preferably alongside Phase J or final hardening, without changing authoritative accounting values or formulas.

See `PHASE_G_DASHBOARD_EXPORT.md` for the detailed contract.

## Phase H — COMPLETE / REVIEW

Phase H implements Engine 2 comparison/fluctuation. Its input is **only FINALIZED Engine 1 history**; it never accepts a separate raw workbook upload.

Locked scope:

- period comparison from finalized Cost Structure history;
- MoM;
- YoY;
- YTD;
- variance amount and percentage;
- contribution to parent/total variance;
- Company / Cost Group / Nature / COA or calculated-item drill-down;
- deterministic server-side comparison service using finalized active Engine 1 runs only.

The Phase H implementation uses deterministic read-service aggregation and creates no comparison transaction table. See `PHASE_H_COMPARISON_ENGINE.md` for its API, precision, availability, identity, and contribution contracts.

Phase I will add materiality, commentary and review workflow after Phase H arithmetic and finalized-history controls are tested.
