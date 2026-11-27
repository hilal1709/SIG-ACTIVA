# Project Blueprint V2 — Cost Structure & Fluktuasi Biaya in SIG ACTIVA

## 1. Product placement

This project is a new accounting domain inside the existing SIG ACTIVA application.

It does not replace the existing Fluktuasi OI/EXP module.

SIG ACTIVA remains one application, one login/session foundation and one PostgreSQL/Prisma environment.

## 2. Product modules

```text
SIG ACTIVA
│
├── Existing modules
│   ├── Laporan Material
│   ├── Fluktuasi OI/EXP
│   ├── Monitoring Prepaid
│   └── Monitoring Accrual
│
└── NEW: Cost Structure & Fluktuasi Biaya
    ├── ENGINE 1 — Monthly Cost Structure
    └── ENGINE 2 — Fluctuation Analysis
```

## 3. Engine 1 — Monthly Cost Structure

### Input

One source workbook per Company/Fiscal Period containing the required raw data in multiple sheets.

Upload metadata is entered in application fields:

```text
Company Code
Fiscal Year
Fiscal Period
Upload Note optional
Workbook
```

No META worksheet.

### Core process

```text
Upload workbook
    ↓
Detect logical sources
    ↓
Parse and normalize
    ↓
Validate
    ↓
CC Group Source Control
sum detail COA = reported CC Group total
    ↓
COA Mapping / explicit exclusion / reclassification
    ↓
Validated existing formulas
    ↓
Build monthly Cost Structure
    ↓
Final Cost Group reconciliation
    ↓
FINALIZE
```

### Company scope

```text
2000
├── ADUM
└── PASAR

7000
├── HPP
├── ADUM
└── PASAR
```

Derivatif is excluded.

### Locked 7000 rules

```text
Total HPP
= Total cost account group 5
- Account-group-5 COGS Mortar
```

```text
Selisih Persediaan
= Total HPP
- Sum of all HPP Natures before Selisih Persediaan
```

```text
Sum all HPP Natures = Total HPP
```

Batubara and OA follow validated existing workbook formulas.

OA remains inside PASAR.

### Engine 1 outputs

```text
Finalized monthly database history
Dashboard Cost Structure
Excel Cost Structure report
Reconciliation/lineage views
```

## 4. Engine 2 — Fluctuation Analysis

### Input

Only finalized Engine 1 historical results.

No separate raw Excel upload for Engine 2.

### Process

```text
Finalized Cost Structure History
        ↓
MoM / YoY / YTD
        ↓
Variance Amount
        ↓
Variance %
        ↓
Contribution
        ↓
Materiality
        ↓
Commentary
        ↓
Review
```

### Output

```text
Fluctuation Dashboard
Detailed analysis
Commentary status
Excel Fluctuation report
```

## 5. Two separate controls in Engine 1

Do not confuse source control with final Cost Structure control.

### Source control

```text
SUM raw CC Group detail COA
=
reported CC Group total
```

This proves the source export is complete.

### Final Cost Structure control

After mapping, allocation/reclassification and formulas:

```text
SUM final Nature
=
final Cost Group total
```

For 7000 HPP:

```text
SUM all HPP Nature = authoritative Total HPP
```

## 6. Source workbook design

### Company 2000 logical sources

Current target:

```text
TB
CC_PROD
CC_ADUM
CC_PASAR
ADJUSTMENT optional
```

### Company 7000 logical sources

Current target:

```text
TB
CC_PROD
CC_ADUM
CC_PASAR
CC_WHRPG
COAL
CLINKER_PURCHASE
SOLAR_PP_ORDER
OA_STAT
ADJUSTMENT optional
```

Exact source aliases and columns are locked from golden workbooks during parser implementation.

## 7. System master vs monthly input

Monthly workbook contains source data only.

Application master stores:

```text
Company
Cost Group
Expense Nature
COA
COA Mapping/effective dates
Materiality
Rule identifiers/configuration
```

New COA is not treated as zero. It becomes an explicit mapping exception.

## 8. Technical integration

Existing stack reused:

```text
Next.js 16
React 19
TypeScript
Prisma 7
PostgreSQL
Custom session authentication
Existing SIG ACTIVA roles
xlsx + exceljs
Existing UI/chart libraries
```

New domain namespace:

```text
/cost-structure/*
/cost-fluctuation/*
/api/cost-structure/*
/api/cost-fluctuation/*
lib/cost-structure/*
lib/cost-fluctuation/*
Cost* Prisma models
```

Existing `/api/fluktuasi/*` and `Fluktuasi*` models stay untouched.

## 9. Data hierarchy

```text
Company
  ↓
Period
  ↓
Cost Group
  ↓
Expense Nature
  ↓
COA / calculated line
  ↓
Source/calculation lineage
```

## 10. Financial data policy

- New monetary fields use Decimal/numeric, not Float.
- Calculated final values are not manually editable.
- Corrections occur through source/mapping/adjustment + rerun.
- Missing comparison period is not zero.
- Denominator zero is N/M where appropriate.
- Engine calculations are deterministic and idempotent.
- AI is not part of the accounting calculation engine.

## 11. Proposed navigation

```text
Cost Structure & Fluktuasi Biaya
├── Dashboard Cost Structure
├── Upload & Proses
├── Cost Structure Bulanan
├── Analisis Fluktuasi
└── Riwayat Periode
```

## 12. Core data model

Separate new models:

```text
CostCompany
CostGroup
CostNature
CostCoa
CostCoaMapping
CostPeriod
CostUpload
CostSourceRow
CostValidationIssue
CostAdjustment
CostCalculationRun
CostActualLine
CostCalculationResult
CostMaterialityRule
CostCommentary
CostCommentaryHistory
CostPeriodReview
CostAuditLog
```

Existing User remains identity authority.

## 13. Development gates

```text
Repository integration
↓
Prisma core
↓
Upload/parser
↓
Source reconciliation/mapping
↓
Engine 1 Company 2000
↓
2000 GOLDEN GATE
↓
Engine 1 Company 7000
↓
7000 GOLDEN GATE
↓
Engine 1 dashboard/export
↓
Engine 2
↓
Commentary/review
↓
Fluctuation dashboard/export
↓
Security/regression/deployment
```

## 14. Definition of success

The module is considered successful when a user can:

1. select company/year/period;
2. upload one multi-sheet raw source workbook;
3. obtain exact source reconciliation;
4. resolve mappings/exceptions;
5. reproduce the validated existing monthly Cost Structure automatically;
6. export the Cost Structure report;
7. accumulate finalized monthly history;
8. run MoM/YoY/YTD without another raw upload;
9. document/review material variance explanations;
10. export the fluctuation report;
11. trace any material result back to its source/calculation run;
12. do all of the above without breaking existing SIG ACTIVA modules.

## 15. Source of truth documents

Detailed implementation rules are maintained in the sibling documents in this folder. When a conflict appears, the latest explicitly approved business rule must be reflected across all documents before coding proceeds.
