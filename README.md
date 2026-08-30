# SIG ACTIVA

SIG ACTIVA is a finance/accounting web application built with Next.js, React, TypeScript, Prisma and PostgreSQL.

Current functional areas include Material reporting, Fluktuasi OI/EXP, Prepaid monitoring, Accrual monitoring, user/security administration, and the planned **Cost Structure & Fluktuasi Biaya** module.

## Technology

- Next.js 16 App Router
- React 19
- TypeScript
- Prisma 7
- PostgreSQL
- Tailwind CSS
- `xlsx` / `exceljs`
- Chart.js / Recharts
- Custom session-cookie authentication

## Development

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Build:

```bash
pnpm build
```

Production database DDL is managed through the controlled Supabase migration workflow documented in `docs/cost-structure-fluctuation/DATABASE_RUNTIME.md`. Do not run the historical Prisma migration chain wholesale against production.

Environment configuration must include the database/session variables required by the existing application. Do not commit secrets or local environment files.

The Cost Structure upload workflow additionally requires these server-only variables:

```text
SUPABASE_URL=https://<project-ref>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<server-only-service-role-key>
COST_STRUCTURE_STORAGE_BUCKET=cost-structure-source
```

The bucket must remain private with a 50 MB file-size limit. Never prefix the service-role credential with `NEXT_PUBLIC_`.

## Cost Structure & Fluktuasi Biaya

The new module is designed as two independent but connected engines:

```text
Monthly Source Workbook
        ↓
Engine 1 — Monthly Cost Structure
        ↓
Finalized Cost Structure History
        ↓
Engine 2 — Fluctuation Analysis
```

Initial scope:

```text
Company 2000: ADUM + PASAR
Company 7000: HPP + ADUM + PASAR
Derivatif: excluded
```

The existing **Fluktuasi OI/EXP** feature remains a separate business domain and must not be repurposed for this module.

Project documentation:

- [Project Blueprint](docs/cost-structure-fluctuation/PROJECT_BLUEPRINT.md)
- [Business Rules](docs/cost-structure-fluctuation/BUSINESS_RULES.md)
- [Architecture](docs/cost-structure-fluctuation/ARCHITECTURE.md)
- [Source Data Specification](docs/cost-structure-fluctuation/SOURCE_DATA_SPEC.md)
- [Data Model](docs/cost-structure-fluctuation/DATA_MODEL.md)
- [Calculation Rules](docs/cost-structure-fluctuation/CALCULATION_RULES.md)
- [UI Flow](docs/cost-structure-fluctuation/UI_FLOW.md)
- [Security](docs/cost-structure-fluctuation/SECURITY.md)
- [Test Cases](docs/cost-structure-fluctuation/TEST_CASES.md)
- [Development Plan](docs/cost-structure-fluctuation/DEVELOPMENT_PLAN.md)
- [Codex Prompts](docs/cost-structure-fluctuation/CODEX_PROMPTS.md)

AI/Codex contributors must also follow root [`AGENTS.md`](AGENTS.md).

## Development rule for financial modules

Accounting results must be validated before UI polish. For the Cost Structure module, company 2000 and company 7000 golden-workbook reconciliation tests are mandatory development gates before Fluctuation Engine implementation.
