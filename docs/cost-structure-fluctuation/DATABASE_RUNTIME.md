# Database Runtime & Migration Status — SIG ACTIVA

Last verified: 2026-08-30

## Current production architecture

SIG ACTIVA does **not** use Supabase client/RLS as its application ORM layer.

The current architecture is:

```text
Next.js / API routes
        ↓
Prisma Client
        ↓
@prisma/adapter-pg + pg Pool
        ↓
DATABASE_URL
        ↓
Supabase PostgreSQL
```

Therefore:

- **Prisma Client remains an active and critical runtime dependency.**
- **Supabase PostgreSQL is the production database host.**
- Application code must continue to use the existing server-side `lib/prisma.ts` pattern unless a separately approved architecture migration replaces it.
- Do not introduce direct browser-to-Supabase database access or Supabase Auth/RLS as a substitute for the existing application auth and server API layer.

Verified runtime examples include authentication, Accrual, Prepaid, Material/other finance APIs and Fluktuasi OI/EXP, all of which access PostgreSQL through Prisma Client.

## Important distinction: Prisma Client vs Prisma Migrate

Historically, the repository contains many Prisma migration folders. However, the production Supabase database had **no Prisma `_prisma_migrations` history** when audited on 2026-08-30.

This means the production schema existed without being managed as an active `prisma migrate deploy` history. The legacy database was likely created/evolved through earlier Prisma workflows, direct PostgreSQL/Supabase changes, `db push`, manual SQL, or a combination of those mechanisms.

Do not interpret the absence of `_prisma_migrations` as meaning Prisma is unused. It only means **Prisma Migrate was not the authoritative production migration ledger**.

## Production migration authority from Phase B onward

Starting with the Cost Structure Phase B migration, use **Supabase-managed migration history** as the production DDL deployment ledger.

The first tracked Cost Structure migration applied to production is:

```text
add_cost_structure_core
Supabase migration version: 20260830081925
Applied: 2026-08-30
```

The SQL corresponds to the reviewed repository migration:

```text
prisma/migrations/20260830080251_add_cost_structure_core/migration.sql
```

Production now contains the 14 `cost_*` core tables and the required Cost Structure enums/indexes/foreign keys.

## Legacy Prisma migration folders

Existing Prisma migration folders created before the production Supabase migration baseline are retained as **historical development artifacts**.

They must **not** be executed wholesale against production using `prisma migrate deploy`, because production already contains the legacy tables while Prisma's migration ledger is absent.

Running all historical migrations against production could attempt to recreate or alter already-existing tables.

Therefore:

- Do not run `prisma migrate reset` against production.
- Do not run `prisma db push` against production.
- Do not run the entire legacy `prisma migrate deploy` chain against production unless a separate migration-baselining project is explicitly approved and tested.
- Do not fabricate `_prisma_migrations` history solely to make old migrations appear applied.

## Development workflow for new schema changes

For new Cost Structure work:

1. Define the intended schema in `prisma/schema.prisma`.
2. Generate/review an additive migration SQL in the repository.
3. Run `prisma format`, `prisma validate`, `prisma generate`, TypeScript and relevant tests.
4. Review migration SQL for destructive legacy operations.
5. Apply approved DDL to Supabase through the controlled Supabase migration mechanism.
6. Verify Supabase migration history and resulting schema.
7. Keep repository schema/migration SQL synchronized with the applied production DDL.

Prisma Client remains the runtime ORM after the migration is applied.

## Phase B production status

Verified on 2026-08-30:

- legacy public schema inspected and remains present;
- no `cost_*` tables existed before Phase B;
- `add_cost_structure_core` applied successfully through Supabase migration tooling;
- Supabase migration history now records `20260830081925 / add_cost_structure_core`;
- Cost Structure company/group master data seeded idempotently;
- Company 2000: ADUM, PASAR;
- Company 7000: HPP, ADUM, PASAR;
- existing legacy tables were not dropped or renamed by the Phase B migration.

## Environment responsibility

`DATABASE_URL` must point to the approved Supabase PostgreSQL connection endpoint suitable for Vercel/serverless use.

Prisma Client and `pg` consume this URL server-side. Database credentials must never be committed to GitHub.

## Architectural rule

Until explicitly changed by an approved architecture decision:

```text
Runtime ORM        = Prisma Client
Database           = Supabase PostgreSQL
Production DDL     = controlled Supabase migrations
Browser DB access  = prohibited
Auth               = existing SIG ACTIVA custom session system
```
