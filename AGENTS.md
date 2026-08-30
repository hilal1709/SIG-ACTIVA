# AGENTS.md

## Repository scope

This repository is SIG ACTIVA, an existing production-oriented accounting application. New work for the Cost Structure & Fluktuasi Biaya module must integrate with the existing architecture instead of creating a second application.

Before changing code for this module, read all documents under `docs/cost-structure-fluctuation/`.

## Existing architecture to preserve

- Next.js 16 App Router + React 19 + TypeScript.
- PostgreSQL through Prisma.
- Existing custom session authentication and role model.
- Existing Sidebar/Header/UI component system.
- Existing Accrual, Prepaid, Material, Fluktuasi OI/EXP, User Management, and Security modules.

Do not replace the existing auth stack with Supabase Auth or introduce direct browser-to-database access.

## Critical isolation rule

The existing `Fluktuasi OI/EXP` module is a different business process and must remain functional.

Do not repurpose or destructively modify:

- `app/fluktuasi-oi`
- `app/overview-fluktuasi`
- `app/detail-akun-fluktuasi`
- `app/api/fluktuasi/*`
- Prisma models beginning with `Fluktuasi`

The new module must use separate namespaces such as:

- UI: `/cost-structure/*`, `/cost-fluctuation/*`
- API: `/api/cost-structure/*`, `/api/cost-fluctuation/*`
- Domain logic: `lib/cost-structure/*`, `lib/cost-fluctuation/*`
- Database models: `Cost*`

## Business architecture

The module contains two engines.

### Engine 1 — Monthly Cost Structure

Input -> validation -> source reconciliation -> mapping -> existing business formulas -> monthly cost structure -> reconciliation -> finalize -> dashboard/export.

Engine 1 replaces the existing monthly Excel cost-structure preparation process.

### Engine 2 — Fluctuation Analysis

Finalized Engine 1 historical data -> MoM/YoY/YTD -> variance -> contribution -> materiality -> commentary -> review -> dashboard/export.

Engine 2 must never calculate directly from uploaded raw Excel files. It consumes only finalized Engine 1 data.

## Input rule

- One Excel workbook per company and fiscal period.
- Workbook contains multiple source-data sheets.
- There is no META worksheet.
- Company, fiscal year, fiscal period and upload note are entered in the Upload Data form before upload.
- Source workbook contains data only.

## Company scope

### Company 2000

- ADUM
- PASAR

### Company 7000

- HPP
- ADUM
- PASAR

Derivatif is out of scope and must not enter calculation, final cost structure, fluctuation analysis, dashboard, or export.

## Locked financial formulas

Do not redesign or simplify existing validated workbook logic.

- Batubara: follow the validated existing workbook formula.
- OA: follow the validated existing workbook formula and keep OA inside PASAR.
- 7000 Total HPP = total cost of account group 5 minus account-group-5 COGS Mortar.
- 7000 Selisih Persediaan = Total HPP minus total of all HPP natures from Bahan Baku through the last nature before Selisih Persediaan.
- Therefore total of all HPP natures must reconcile exactly to Total HPP.

Do not hard-code Excel row positions. Identify business items through explicit mappings/rule codes.

## Source controls

For every Cost Center Group source:

`sum(detail per COA) = reported CC Group total`

A non-zero difference blocks calculation.

Additional controls:

- Validated source must be fully accounted for by mapping, explicit exclusion, or reclassification.
- Nature total must equal its underlying COA detail except calculated/residual natures.
- Cost-group total must equal sum of its natures.
- HPP reconciliation difference must be zero before finalization.

## Mapping rules

- Mapping belongs in system master data, not monthly workbook files.
- Unmapped COA must never silently become zero.
- New COA must be resolved or explicitly excluded with a reason.
- Historical mappings must be versioned/effective-dated.

## Accounting data types

For all new financial amount fields use Prisma Decimal / PostgreSQL numeric, not Float.

Recommended baseline: `Decimal @db.Decimal(20, 2)`.

Never manually edit finalized calculated amounts. Correct source/mapping/rule input and rerun calculation instead.

## Calculation principles

- Calculations must be deterministic and idempotent.
- AI must not calculate accounting amounts or decide business formulas.
- Missing comparison periods are not zero.
- Percentage variance denominator zero must be represented as N/M through status/null semantics, not a numeric 0%.
- Calculation results must be traceable to upload version, source sheet/row, mapping/rule and calculation run.

## Authorization

Reuse the existing session system.

Add module-specific server-side authorization helpers rather than weakening or globally changing existing finance helpers.

Baseline intent:

- Read: authorized finance roles.
- Prepare/write: ADMIN_SYSTEM and STAFF_ACCOUNTING.
- Review/finalize: ADMIN_SYSTEM and SUPERVISOR_ACCOUNTING.
- Administration/master changes: ADMIN_SYSTEM.

Enforce permissions in API/server code, not only in UI.

## Development discipline

- Work phase-by-phase using `docs/cost-structure-fluctuation/DEVELOPMENT_PLAN.md`.
- Do not implement later phases early unless required by an accepted dependency.
- Preserve unrelated existing behavior.
- Add tests for every financial rule before UI polish.
- Golden workbook reconciliation is a release gate.
- Do not proceed from Engine 1 company 2000 to 7000 until the 2000 golden tests pass.
- Do not proceed to Engine 2 until Engine 1 finalized outputs pass golden reconciliation for both companies.

## Required checks before completion of any coding task

Run the repository's applicable lint, build and tests. Report any existing unrelated failures separately; do not hide them by weakening checks.
