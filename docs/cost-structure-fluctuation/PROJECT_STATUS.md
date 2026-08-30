# Project Status — Cost Structure & Fluktuasi Biaya

Last updated: 2026-08-30

## Overall status

```text
Phase A — Repository integration foundation       COMPLETE / merged to main
Phase B — Core schema & master data               COMPLETE / production DDL applied
Phase C — Upload/parser/storage                    COMPLETE / merged to main
Phase D — Source reconciliation/mapping            COMPLETE / production DDL applied
Phase E — Engine 1 Company 2000                    COMPLETE / PRODUCTION GOLDEN E2E PASS
Phase F — Engine 1 Company 7000                    ENGINE CONTRACT READY / SOURCE ADAPTER + REAL E2E PENDING
Phase G — Finalization/dashboard/export            NOT STARTED / EXPORT CONTRACT LOCKED
Phase H — Engine 2 comparison                      NOT STARTED
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

Production DDL is controlled through reviewed Supabase migrations. Historical repository Prisma migrations are not an executable production migration chain.

Never run against production:

```text
prisma migrate deploy
prisma migrate reset
prisma db push
```

Private workbooks and secrets must never be committed.

## Completed foundation — Phases A to D

Implemented and production-proven:

- Cost Structure navigation/routes/auth and legacy isolation;
- private Supabase Storage upload with signed browser upload and SHA-256 lineage;
- versioned source workbooks and normalized `CostSourceRow` staging;
- validation issue register;
- conservative source CC reconciliation;
- effective-dated source-specific COA mapping;
- INCLUDE / EXCLUDE / RECLASS;
- non-zero unmapped blocking and zero-amount unmapped non-blocking behavior;
- mapping completeness/readiness and `SOURCE_RECONCILED` transition.

Relevant merged milestones include PR #3 (core), PR #4 (upload), PR #5 (reconciliation), PR #7 (Company 2000 source parity), and parser/UX hotfixes through PR #14.

## Phase E — Company 2000 Engine 1 — COMPLETE

Company 2000 scope:

```text
ADUM
PASAR
```

Locked July-2026 golden:

```text
ADUM   107,796,550,061
PASAR   17,900,551,142
TOTAL  125,697,101,203
```

Production application E2E has completed:

```text
Upload               PASS
Validation           PASS
Source reconciliation PASS
Mapping coverage     PASS
Calculation          PASS
Active run           SUCCESS / ENGINE1_2000_V1
ADUM difference      0
PASAR difference     0
Period status        CALCULATED
```

The real private workbook was used through the deployed application; it remains outside GitHub. Company 2000 is the regression baseline and must not change to accommodate Company 7000.

## Phase F — Company 7000

PR #15 implements the Company 7000 arithmetic/domain foundation:

- scope `HPP`, `ADUM`, `PASAR`;
- authoritative `Decimal(20,2)` values using `Prisma.Decimal`;
- `HPP_TOTAL_7000`;
- `COAL_7000_EXISTING`;
- `COAL_INBOUND_7000_EXISTING`;
- `OA_7000_EXISTING` inside PASAR;
- `HPP_INVENTORY_DIFF_7000` as COA-less residual;
- FORMULA/RESIDUAL protection from direct mapping and normal adjustment;
- Derivatif zero effect;
- formula source-row lineage;
- Company 7000 Nature master bootstrap migration;
- monthly UI support for future Company 7000 results.

Code-level July-2026 golden contract:

```text
HPP              413,169,722,810.00
ADUM              11,667,383,975.00
PASAR regular      9,572,860,045.00
OA                 72,068,727,025.00
PASAR total        81,641,587,070.00
TOTAL COMPANY     506,478,693,855.00
Batubara           93,152,232,023.32
Batubara Inbound   41,023,853,211.68
Selisih Persediaan -21,153,010,152.00
HPP difference                     0.00
```

The private Company 7000 source workbooks were not available in the Codex workspace. Exact selectors/adapters for account-group-5/COGS Mortar, COAL H10+H18, COAL Inbound I10+I18, and OA remain unresolved. The calculation endpoint therefore fails closed for Company 7000, and the UI must not offer an enabled Run Calculation action until that adapter is verified.

Phase F is not production-E2E complete until the real Company 7000 workbook passes:

```text
Upload → Validation → Source Reconciliation → Mapping → Calculation
```

and reproduces the locked golden values exactly.

## Phase G — locked dashboard/export requirement

The later Dashboard/Excel Export phase must consume the authoritative active/final Engine 1 run and must not recalculate accounting values during export.

Required workbook output includes at minimum:

### Common output sheets

- `SI` — Cost Structure output in the agreed existing format;
- `Rincian Biaya` — Nature/COA/formula detail with lineage;
- `cc prod` — raw/traceable production Cost Center source for manual audit;
- `cc ADM` — raw/traceable ADUM Cost Center source for manual audit;
- `cc pasar` — raw/traceable PASAR Cost Center source for manual audit.

### Company 7000 supporting audit sheets

Where required by the validated formula dependency, export must also retain sufficient audit material for:

- `TB` / account-group-5 and COGS Mortar control;
- `cc WHRPG`;
- `COAL` / Batubara calculation;
- `OA_STAT` / OA calculation;
- `CLINKER_PURCHASE`;
- `SOLAR_PP_ORDER`;
- other validated supporting source sheets used by the active run.

A dedicated `Formula Audit` sheet is recommended for Company 7000 to show rule code, source references, components, formula result and residual reconciliation for Batubara, Batubara Inbound, OA, Total HPP and Selisih Persediaan.

Source audit sheets should be generated from the validated active upload/source lineage, while exact source-sheet presentation may use the original private workbook in Storage where preserving the original manual-audit layout is required.

## Next action

1. Merge PR #15 only after review/build is green.
2. Apply the reviewed Company 7000 Nature bootstrap migration to production.
3. Inspect the real private Company 7000 workbooks and implement the verified source adapter without inventing selectors.
4. Run Company 7000 upload → reconciliation → mapping → calculation golden E2E.
5. Only after exact production parity, close Phase F and proceed to Phase G implementation.
