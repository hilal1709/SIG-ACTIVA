# Project Status — Cost Structure & Fluktuasi Biaya

Last updated: 2026-08-30

## Overall status

```text
Phase A — Repository integration foundation       COMPLETE / merged to main
Phase B — Core schema & master data               COMPLETE / merged to main / production DDL applied
Phase C — Upload/parser/storage                    COMPLETE / merged to main
Phase D — Source reconciliation/mapping            NOT STARTED
Phase E — Engine 1 Company 2000                    NOT STARTED
Phase F — Engine 1 Company 7000                    NOT STARTED
Phase G — Finalization/dashboard/export            NOT STARTED
Phase H — Engine 2 comparison                      NOT STARTED
Phase I — Materiality/commentary/review             NOT STARTED
Phase J — Fluctuation dashboard/export              NOT STARTED
Phase K — Hardening/deployment                     NOT STARTED
```

## Phase A status

Completed and merged to `main`:

- new Cost Structure & Fluktuasi Biaya navigation;
- route shells;
- module-specific authorization foundation;
- isolated API/domain namespaces;
- existing Fluktuasi OI/EXP preserved.

## Phase B status

PR #3 was reviewed and squash-merged to `main` as commit:

```text
5eebf045388475f156fe54cc4b0f83d5d926c39b
```

Repository-side Phase B implementation includes:

- 14 new `Cost*` Prisma models;
- 7 Cost Structure enums;
- additive Cost Structure migration SQL;
- idempotent master seed for company/group;
- server-side master-data query service;
- database runtime and migration authority documentation.

### Production database application

The reviewed Phase B DDL has been applied to the production Supabase PostgreSQL database through Supabase migration tooling.

Recorded Supabase migration:

```text
version: 20260830081925
name: add_cost_structure_core
```

Verified production seed:

```text
2000 → ADUM, PASAR
7000 → HPP, ADUM, PASAR
```

No Cost Structure calculation data has been created yet.

## Database architecture status

Prisma is **still used**.

Current runtime:

```text
Next.js/API
  → Prisma Client
  → PrismaPg / pg
  → DATABASE_URL
  → Supabase PostgreSQL
```

The production database host is Supabase PostgreSQL. Prisma Client is the application ORM/runtime query layer.

The legacy production schema did not contain Prisma `_prisma_migrations` history when audited. Therefore old repository Prisma migrations are not treated as an executable production migration chain.

From Phase B onward, controlled Supabase migration history is the production DDL ledger. See `DATABASE_RUNTIME.md` for the authoritative migration policy.

## Current database safety state

Verified before Phase B migration:

- existing legacy SIG ACTIVA public tables were present;
- production Cost Structure `cost_*` tables were absent;
- legacy schema was inspected before DDL execution;
- Phase B migration contained no DROP/TRUNCATE/destructive legacy ALTER operation.

Verified after Phase B migration:

- Supabase migration history contains `add_cost_structure_core`;
- 14 Cost Structure core tables exist;
- company/group master seed exists;
- existing legacy business tables remain present.

## Current deployment note

Vercel deployment requires a valid production `DATABASE_URL` because many existing SIG ACTIVA API routes instantiate Prisma Client during build/runtime.

Do not weaken the `DATABASE_URL` requirement to bypass deployment configuration.

## Phase C status

PR #4 was reviewed and squash-merged to `main` as commit:

```text
c59d4f2d3f8a1f0c552c8a8a44ce669ba4c0c067
```

Phase C implementation includes:

- durable storage provider: Supabase Storage;
- private bucket: `cost-structure-source`;
- bucket/file limit: 50 MB;
- browser upload: temporary signed direct upload to the server-generated object path using the Supabase signed-upload multipart contract;
- integrity authority: SHA-256 computed by the server from downloaded stored bytes;
- upload context: short-lived HMAC signed with the existing application auth secret and bound to uploader/company/period/object key;
- transactional upload versioning and previous-version preservation on failure;
- business data runtime: Prisma Client remains the ORM over Supabase PostgreSQL;
- output: normalized source rows, validation issues, upload versions, and source lineage;
- support sources whose exact golden headers are not yet locked preserve raw lineage without inventing accounting semantics;
- cross-platform Cost Structure test runner;
- accounting calculation: not implemented in Phase C.

Phase D and every later phase remain `NOT STARTED`.

## Completed Phase C gate

Phase C retained these constraints:

1. private durable workbook storage, not Vercel filesystem or PostgreSQL blobs;
2. server-authoritative metadata, object key, SHA-256, uploader and period context;
3. duplicate/replay/version controls preserve the last valid active upload;
4. source rows remain `UNMAPPED` pending Phase D;
5. no source reconciliation, mapping resolution, or financial calculation is introduced.

Phase C is closed. The next implementation phase is Phase D — Source Reconciliation & Mapping Workflow.
