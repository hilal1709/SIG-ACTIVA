# Cost Structure & Fluktuasi Biaya — Project Documentation V2

Status: Blueprint baseline for implementation inside SIG ACTIVA.

This documentation supersedes the earlier standalone-application assumption. The module will be developed inside the existing `hudavariausaha/SIG-ACTIVA` repository and will reuse its Next.js, Prisma/PostgreSQL, authentication, roles, UI shell, Excel libraries, and deployment foundation.

## Product objective

The module replaces two related monthly finance workflows:

1. Monthly Cost Structure preparation.
2. Cost fluctuation analysis based exclusively on finalized Monthly Cost Structure history.

The two processes are implemented as separate engines so that accounting formation and analytical comparison cannot be mixed.

## Engine 1 — Monthly Cost Structure

Responsibilities:

- accept one multi-sheet source workbook per company and period;
- capture metadata in the application upload form, not inside the workbook;
- parse source sheets;
- validate source structure and values;
- reconcile CC Group totals to detail per COA;
- apply COA/nature mappings and approved existing formulas;
- calculate company cost structure;
- reconcile final cost groups;
- finalize period results;
- provide Cost Structure dashboard;
- export an Excel Cost Structure report comparable to the existing workbook output.

## Engine 2 — Fluctuation Analysis

Responsibilities:

- read only finalized Engine 1 historical outputs;
- calculate MoM, YoY and YTD comparisons;
- calculate variance amount, percentage and contribution;
- apply materiality rules;
- manage commentary and review;
- provide a Fluctuation dashboard;
- export the analytical report to Excel.

## Initial company scope

| Company | HPP | ADUM | PASAR |
|---|---:|---:|---:|
| 2000 | No | Yes | Yes |
| 7000 | Yes | Yes | Yes |

Derivatif is explicitly excluded.

## Existing module isolation

The current `Fluktuasi OI/EXP` feature is not replaced. The new module is a separate domain and must use separate routes, APIs and Prisma models.

Recommended menu:

```text
Cost Structure & Fluktuasi Biaya
├── Dashboard Cost Structure
├── Upload & Proses
├── Cost Structure Bulanan
├── Analisis Fluktuasi
└── Riwayat Periode
```

## Document map

- `BUSINESS_RULES.md` — finalized scope and business controls.
- `ARCHITECTURE.md` — integration architecture inside SIG ACTIVA.
- `SOURCE_DATA_SPEC.md` — input workbook and upload-form contract.
- `DATA_MODEL.md` — proposed Prisma/PostgreSQL data model.
- `CALCULATION_RULES.md` — deterministic calculation rules for both engines.
- `UI_FLOW.md` — menus, screens and end-to-end user flow.
- `SECURITY.md` — roles, server authorization and audit controls.
- `TEST_CASES.md` — financial, parser, authorization and regression tests.
- `DEVELOPMENT_PLAN.md` — phase order and acceptance gates.
- `CODEX_PROMPTS.md` — constrained prompts for phased implementation.

## Current technical foundation reused from SIG ACTIVA

- Next.js App Router.
- React + TypeScript.
- Prisma + PostgreSQL.
- Existing session-cookie authentication.
- Existing role model.
- Existing Sidebar/Header and UI components.
- `xlsx` and `exceljs` for workbook input/output.
- Existing chart libraries.

## Non-goals for MVP

- SAP direct integration.
- Derivatif analysis.
- Budget/forecast comparison.
- AI-generated accounting calculation.
- Automatic journals.
- Manual editing of calculated final amounts.
- Replacing the existing Fluktuasi OI/EXP module.

## Release principle

Correct accounting results are a prerequisite for visualization. Development must prove source reconciliation and golden-workbook equality before dashboard polish or advanced analytics.
