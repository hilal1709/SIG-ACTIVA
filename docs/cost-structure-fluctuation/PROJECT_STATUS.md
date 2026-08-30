# Project Status — Cost Structure & Fluktuasi Biaya

Last updated: 2026-08-30

## Overall status

```text
Phase A — Repository integration foundation       COMPLETE / merged to main
Phase B — Core schema & master data               COMPLETE / merged / production DDL applied
Phase C — Upload/parser/storage                    COMPLETE / merged to main
Phase D — Source reconciliation/mapping            COMPLETE / merged / production DDL applied
Phase E — Engine 1 Company 2000                    ENGINE + GOLDEN SOURCE PARITY MERGED / APPLICATION E2E PENDING
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

Golden-source parity correction PR #7 was reviewed and squash-merged as:

```text
808620663c00af3f122aa73bc9bff9f618667d32
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

Phase E unit/arithmetic gate:

```text
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

The confidential workbooks remain outside the repository.

### Golden source structure verified

The real July-2026 private workbook has now been inspected. Locked source facts include:

- `tb` → `TB`;
- `cc_adm` → `CC_ADUM`;
- `cc pasar` → `CC_PASAR`;
- `cc_prod` is structurally present but financially empty for the verified Company 2000 fixture;
- SAP Cost Center total marker is `* Debit`;
- `** Over/Underabsorption` is a duplicate/control row and is not double counted;
- Company 2000 accounting contribution comes from `CC_ADUM` and `CC_PASAR` only;
- `CC_PROD` and Derivatif have zero Company 2000 Cost Structure effect.

Parser/reconciliation parity for those verified source facts is merged in PR #7.

### Golden production master readiness

Production has been bootstrapped from the private golden workbook without committing private COA lists to GitHub:

```text
Company 2000 active Nature masters     18  (9 ADUM + 9 PASAR)
Effective non-zero source mappings    159
  INCLUDE                             145
  EXCLUDE                              14
Invalid INCLUDE targets                 0
Overlapping effective mapping keys      0
```

Mappings are source-specific and effective from 2026-07-01. Zero-amount source COAs are intentionally not forced into mapping solely for the golden gate because they do not change financial output or readiness.

Current Phase E gate:

```text
ENGINE IMPLEMENTATION          PASS / MERGED
ARITHMETIC CONTRACT            PASS
GOLDEN SOURCE STRUCTURE        PASS / VERIFIED
PARSER/RECONCILIATION PARITY   PASS / MERGED
PRODUCTION GOLDEN MASTER       READY
REAL APPLICATION WORKBOOK E2E  PENDING USER-AUTHENTICATED UPLOAD
```

**Phase E is not fully closed and Phase F must not begin until the real July-2026 workbook is processed through the deployed Phase C → D → E application pipeline and reproduces the locked PASAR, ADUM and TOTAL values exactly.**

See `GOLDEN_DATASET.md` for the golden-data contract.

## Next action

Using an authenticated ADMIN_SYSTEM or STAFF_ACCOUNTING application session, upload:

```text
TB 2000 07-2026 (Exc Derivatif)(1).xlsx
```

with:

```text
Company Code  2000
Fiscal Year   2026
Fiscal Period 7
```

The separate `Fluktuasi Biaya 2000 - 07.2026.xlsx` is the locked reference output/mapping source and is not the Phase C source upload.

Then run Phase D reconciliation/readiness and Phase E calculation. Compare the active calculation run against:

```text
PASAR 17,900,551,142
ADUM  107,796,550,061
TOTAL 125,697,101,203
```

Only after exact application E2E reconciliation passes may Phase F — Company 7000 Engine 1 start.
