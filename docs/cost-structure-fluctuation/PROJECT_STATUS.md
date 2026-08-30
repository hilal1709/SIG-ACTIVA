# Project Status — Cost Structure & Fluktuasi Biaya

Last updated: 2026-08-30

## Overall status

```text
Phase A — Repository integration foundation       COMPLETE / merged to main
Phase B — Core schema & master data               COMPLETE / merged / production DDL applied
Phase C — Upload/parser/storage                    COMPLETE / merged to main
Phase D — Source reconciliation/mapping            COMPLETE / merged / production DDL applied
Phase E — Engine 1 Company 2000                    ENGINE MERGED / PRIVATE GOLDEN E2E PENDING
Phase F — Engine 1 Company 7000                    NOT STARTED — BLOCKED BY PHASE E GOLDEN E2E
Phase G — Finalization/dashboard/export            NOT STARTED
Phase H — Engine 2 comparison                      NOT STARTED
Phase I — Materiality/commentary/review             NOT STARTED
Phase J — Fluctuation dashboard/export              NOT STARTED
Phase K — Hardening/deployment                     NOT STARTED
```

## Architecture status

Prisma is still the application ORM/runtime layer.

```text
Next.js/API
  → Prisma Client
  → PrismaPg / pg
  → DATABASE_URL
  → Supabase PostgreSQL
```

Production DDL is controlled through reviewed Supabase migrations. Historical repository Prisma migrations are not an executable production migration chain and must not be deployed wholesale.

Never run against production:

```text
prisma migrate deploy
prisma migrate reset
prisma db push
```

See `DATABASE_RUNTIME.md` for the authoritative database policy.

## Phase A

Repository integration foundation is complete:

- Cost Structure & Fluktuasi Biaya navigation and route namespaces;
- module-specific authorization helpers;
- strict isolation from legacy Fluktuasi OI/EXP.

## Phase B

PR #3 was squash-merged to `main` as:

```text
5eebf045388475f156fe54cc4b0f83d5d926c39b
```

Production Supabase migration:

```text
20260830081925  add_cost_structure_core
```

Production master seed verified:

```text
2000 → ADUM, PASAR
7000 → HPP, ADUM, PASAR
```

The core Cost Structure tables, upload/versioning, calculation-run and audit models are available.

## Phase C

PR #4 was squash-merged to `main` as:

```text
c59d4f2d3f8a1f0c552c8a8a44ce669ba4c0c067
```

Implemented:

- private Supabase Storage bucket `cost-structure-source`;
- 50 MB workbook limit;
- signed direct browser upload;
- server-authoritative metadata/object key/SHA-256/uploader context;
- transactional upload versioning;
- logical-source parsing and normalized `CostSourceRow` lineage;
- validation issue register;
- no accounting calculation.

## Phase D

PR #5 was reviewed, corrected and squash-merged to `main` as:

```text
67c6992c0db0a62fee066343e2ce7a13141e3471
```

Production Supabase migration:

```text
20260830093538  add_cost_mapping_source_scope
```

Implemented:

- conservative CC Group detail-vs-reported-total reconciliation;
- control/subtotal classification without double counting;
- source-specific effective-dated COA mappings;
- INCLUDE / EXCLUDE / RECLASS dispositions;
- nullable Cost Group/Nature targets for EXCLUDE without fake accounting masters;
- mapping completeness and unresolved-COA blockers;
- finalized-period mapping protection;
- audit trail and Nature administration;
- `SOURCE_VALIDATION → SOURCE_RECONCILED` readiness transition;
- no Engine 1 calculation.

Final review also corrected mapping-completeness difference semantics, future-interval overlap protection, and runtime validation of active MAPPED targets.

## Phase E — Company 2000 Engine 1

PR #6 was reviewed, corrected and squash-merged to `main` as:

```text
51e2ea8fe426c9061ce6d17874ce95421b2b2df9
```

Engine implementation is merged for Company 2000 only:

```text
ADUM
PASAR
```

Implemented:

- pure deterministic Company 2000 calculation using exact `Prisma.Decimal` arithmetic;
- one contributing source row → one `CostActualLine` lineage record;
- explicit adjustment lines;
- effective mapping re-resolution at calculation time;
- Derivatif/support/control/excluded source isolation;
- exact Nature totals;
- `TOTAL_ADUM`, `TOTAL_PASAR`, and `TOTAL_COMPANY`;
- ADUM/PASAR Nature reconciliation controls;
- deterministic source and mapping snapshots;
- sequential/versioned calculation runs;
- atomic active-run switch and failed-run preservation;
- bounded/chunked `CostActualLine` persistence;
- correct Cost Group foreign keys even when a group has zero contributing Nature lines;
- Decimal-safe UI formatting without converting accounting values through JavaScript `Number`;
- period transition to `CALCULATED` only after successful calculation;
- no finalization and no Company 7000 calculation.

Phase E unit/arithmetic gate from Codex:

```text
42 Cost Structure tests passed
GOLDEN ENGINE CONTRACT = IMPLEMENTED
```

### Company 2000 authoritative golden baseline

Reference period: July 2026.

```text
PASAR = 17,900,551,142
ADUM  = 107,796,550,061
TOTAL = 125,697,101,203
Derivatif effect = 0
```

These expected values are locked and must never be changed to accommodate system output.

Private reference source names:

```text
Fluktuasi Biaya 2000 - 07.2026.xlsx
TB 2000 07-2026 (Exc Derivatif)(1).xlsx
```

The confidential workbook fixture is not stored in the repository.

Current Phase E gate:

```text
ENGINE IMPLEMENTATION     PASS / MERGED
ARITHMETIC CONTRACT       PASS
VERCEL PREVIEW            READY
REAL GOLDEN WORKBOOK E2E  PENDING PRIVATE FIXTURE
```

**Phase E is not fully closed and Phase F must not begin until the real July-2026 workbook E2E reproduces the locked PASAR, ADUM and TOTAL values exactly.**

See `GOLDEN_DATASET.md` for the golden-data contract.

## Next action

Provide/run the private Company 2000 July-2026 reference workbook through the Phase C → D → E pipeline, configure the verified Nature/mapping masters required by that workbook, and compare the resulting active calculation run against the locked golden amounts.

Only after that exact reconciliation passes may Phase F — Company 7000 Engine 1 start.
