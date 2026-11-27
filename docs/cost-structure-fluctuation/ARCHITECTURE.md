# Architecture V2 — Integration inside SIG ACTIVA

## 1. Architectural decision

The Cost Structure & Fluktuasi Biaya capability is implemented as a new domain inside the existing SIG ACTIVA application.

Do not create a separate Next.js application.

Reuse:

- Next.js App Router;
- React + TypeScript;
- Prisma + PostgreSQL;
- existing session-cookie authentication;
- existing role model;
- existing Sidebar/Header and UI components;
- existing Excel libraries (`xlsx`, `exceljs`);
- existing charting libraries;
- existing deployment pipeline.

## 2. Existing module isolation

The current Fluktuasi OI/EXP feature remains independent.

Do not reuse its Prisma models as the primary data store for the new module because its schema is optimized for account-sheet JSON imports and keyword classification rather than monthly Cost Structure lineage/reconciliation.

Separate domain namespaces are mandatory.

## 3. Route structure

Recommended UI routes:

```text
/cost-structure
/cost-structure/upload
/cost-structure/monthly
/cost-structure/periods
/cost-structure/master
/cost-fluctuation
```

Recommended API routes:

```text
/api/cost-structure/periods
/api/cost-structure/uploads
/api/cost-structure/validate
/api/cost-structure/mappings
/api/cost-structure/calculate
/api/cost-structure/reconciliation
/api/cost-structure/finalize
/api/cost-structure/export

/api/cost-fluctuation/analysis
/api/cost-fluctuation/commentary
/api/cost-fluctuation/review
/api/cost-fluctuation/export
```

Do not add new endpoints under `/api/fluktuasi/*`.

## 4. Suggested code organization

```text
app/
├── cost-structure/
│   ├── page.tsx
│   ├── upload/page.tsx
│   ├── monthly/page.tsx
│   ├── periods/page.tsx
│   └── master/page.tsx
│
├── cost-fluctuation/
│   └── page.tsx
│
└── api/
    ├── cost-structure/
    └── cost-fluctuation/

lib/
├── cost-structure/
│   ├── parsers/
│   ├── validation/
│   ├── mapping/
│   ├── calculations/
│   ├── reconciliation/
│   ├── lineage/
│   └── export/
│
└── cost-fluctuation/
    ├── analysis/
    ├── materiality/
    └── export/
```

The exact file split may evolve, but accounting formulas must remain outside large client components.

## 5. Two-engine boundary

### Engine 1

```text
Upload form metadata
        +
Multi-sheet source workbook
        ↓
Parser
        ↓
Raw/staging rows
        ↓
Validation
        ↓
Source reconciliation
        ↓
Mapping / reclassification
        ↓
Existing deterministic formulas
        ↓
Final Cost Structure calculation
        ↓
Final reconciliation
        ↓
FINALIZED MONTHLY COST STRUCTURE
        ↓
Dashboard + Excel Export + History
```

### Engine 2

```text
FINALIZED MONTHLY COST STRUCTURE HISTORY
        ↓
MoM / YoY / YTD
        ↓
Variance / contribution
        ↓
Materiality
        ↓
Commentary / review
        ↓
Dashboard + Excel Export
```

No raw Excel dependency is allowed from Engine 2.

## 6. Client/server boundary

Financial parsing, validation, mapping, calculation, reconciliation, finalization and export generation are server responsibilities.

Client responsibilities:

- form input;
- file selection/upload;
- progress/status display;
- review interaction;
- dashboard rendering.

Do not put authoritative accounting formulas in React components.

## 7. Database access

Continue using `lib/prisma.ts` and the existing server-side Prisma pattern.

There is no Supabase RLS requirement for this module because the application does not expose direct browser database access.

Authorization must be enforced by server route helpers and domain-service checks.

## 8. Monetary precision

Existing legacy SIG ACTIVA models may use `Float`, but all new Cost Structure financial values must use Prisma `Decimal` mapped to PostgreSQL `numeric`.

Recommended baseline:

```text
Decimal @db.Decimal(20, 2)
```

Domain calculations must avoid JavaScript floating-point accumulation for authoritative results. Use Decimal-compatible handling consistently.

## 9. Workbook storage

The system must preserve upload identity and lineage.

`CostUpload` stores at minimum:

- original file name;
- SHA-256 hash;
- file size;
- company/year/period metadata;
- upload version;
- storage reference;
- uploader/timestamps/status.

The original workbook must use durable storage rather than ephemeral Vercel local filesystem.

Storage implementation should be behind a small adapter so the calculation domain is not tied to one vendor. Before implementation, select the existing/approved durable storage provider for SIG ACTIVA. If no provider is already configured, this is an explicit infrastructure decision for the upload phase.

## 10. Parser architecture

Use logical source parsers rather than one monolithic workbook parser.

Example contract:

```text
WorkbookParser
  ├── TB parser
  ├── CC Group parser
  ├── Coal source parser
  ├── OA support parser
  └── Adjustment parser
```

Parser output must be normalized server-side with source sheet and source row references.

Parser must not depend on formulas being recalculated by Excel on the server. Required business logic is implemented in the application.

## 11. Rule registry

Do not store arbitrary executable formulas in the database.

Use stable rule codes implemented and tested in application code, with database configuration only for identifiers/mappings/effective dates.

Examples:

```text
HPP_TOTAL_7000
HPP_INVENTORY_DIFF_7000
COAL_7000_EXISTING
OA_7000_EXISTING
```

The application may display rule descriptions but users must not edit executable financial expressions through the UI.

## 12. Calculation run model

Each Engine 1 calculation creates a versioned run.

A run captures:

- company and period;
- exact active upload version;
- mapping version/effective-date context;
- rule version identifiers;
- start/completion time;
- status;
- reconciliation outcomes.

A repeated run over identical inputs must produce identical outputs.

Only an explicitly activated successful run becomes the current finalized result.

## 13. Finalization model

A period becomes `FINALIZED` only when:

- mandatory source sheets exist;
- no blocking validation errors remain;
- all CC Group source controls reconcile;
- no unresolved unmapped amount remains;
- calculation completed successfully;
- final cost-group reconciliation is zero;
- HPP reconciliation is zero where applicable.

Engine 2 queries only finalized data.

## 14. Engine 2 query strategy

Do not duplicate every MoM/YoY/YTD result as a transactional table unless later performance requirements justify snapshots.

Initial implementation may compute comparisons through server query/service aggregation over finalized historical Cost Structure records.

Commentary/review records are persisted because they are workflow data.

## 15. Export architecture

Excel exports are generated server-side from finalized database results using `exceljs`.

Engine 1 export reflects monthly Cost Structure.

Engine 2 export reflects analytical comparisons and commentary.

The exported workbook contains values and presentation needed by users but is not the authoritative accounting engine; the database finalized run remains authoritative.

## 16. Sidebar integration

Add one new parent menu without altering existing Fluktuasi OI/EXP hierarchy:

```text
Cost Structure & Fluktuasi Biaya
├── Dashboard Cost Structure
├── Upload & Proses
├── Cost Structure Bulanan
├── Analisis Fluktuasi
└── Riwayat Periode
```

Administrative master screens can appear under the parent for authorized users or under a shared admin section.

## 17. Realtime behavior

Existing SSE/realtime infrastructure may be reused for long-running upload/calculation status notifications if useful, but it is not required to make accounting calculations correct.

Do not make financial correctness depend on realtime delivery.

## 18. Compatibility strategy

Development must be additive.

Every phase must run regression checks for existing:

- login/session;
- dashboard;
- Material;
- Accrual;
- Prepaid;
- Fluktuasi OI/EXP;
- user/security pages.

Do not rename/remove legacy routes or Prisma models as part of this module unless separately approved.

## 19. Company 2000 Engine 1 SI adapter (V2)

V2 reads only persisted `CostSourceRow` data. `AUDIT_RINCIAN` remains a raw DB-export snapshot and
is adapted to COA-level ADM/PASAR deltas. `AUDIT_CC_DRV` is adapted from `COLUMN_29`/`COLUMN_30`
into negative PASAR lines. Actual lines retain real COA/source-row lineage and rule codes for Rincian,
derivative, and manual adjustments. Dashboard/export never reparses Storage.

The Engine 2 direction is final SI for 2000 and persisted GHoPO + DERIV for 7000. Existing Phase H
code is intentionally unchanged pending its dedicated source-basis refactor.


## Engine 2 V2 analysis bases (2026-08-31)

Engine 2 derives only from a FINALIZED period and its active SUCCESS calculation run/upload. Company 2000 has one `SI` analysis basis (final Engine 1 V2 detail independently controlled against `AUDIT_SI`). Company 7000 has separate additive `GHOPO` and `DERIV` analysis bases: GHOPO retains finalized Engine 1 detail and is controlled against `AUDIT_GHOPO`; DERIV is parsed from `AUDIT_DERIV` on that same upload in Rp-thousand and normalized to full IDR. DERIV remains excluded from Company 7000 Engine 1 and is never a Cost Group.

The hierarchy and stable identity are Company -> Analysis Basis -> Cost Group -> Nature -> COA/calculated item. Keys are basis-qualified (`basis:<BASIS>:group:<id>:nature:<id>:...`) and monthly run/upload identity remains lineage, not node identity. All parity uses Decimal normalization to two financial decimal places. Missing source controls and non-reconciling finalized sources are integrity failures, while missing comparison periods remain `UNAVAILABLE`.

PR #23 remains HOLD. Its Phase I assumptions about legacy unqualified analysis keys are superseded; after Engine 2 V2 merges, Phase I must be rebased and adapted separately. Phase I materiality, commentary, and review are not part of this redesign.
