# UI Flow V2

## 1. Navigation

Keep existing SIG ACTIVA navigation and add a new parent menu:

```text
Cost Structure & Fluktuasi Biaya
├── Dashboard Cost Structure
├── Upload & Proses
├── Cost Structure Bulanan
├── Analisis Fluktuasi
└── Riwayat Periode
```

The existing `Fluktuasi OI/EXP` menu and children remain unchanged.

Administrative master screens may be shown only to authorized roles.

## 2. Dashboard Cost Structure

Purpose: answer `what is the current monthly cost structure and is it reconciled?`

Global filters:

```text
Company
Fiscal Year
Fiscal Period
```

KPI cards:

```text
Total Cost
HPP       [7000 only]
ADUM
PASAR
Unmapped COA
Source Reconciliation Status
Period Status
```

Additional company-7000 control:

```text
HPP Reconciliation Difference
```

Recommended visuals:

- Cost Group composition;
- Expense Nature composition;
- top Nature amounts;
- monthly Cost Structure trend;
- reconciliation/control summary.

Drill-down:

```text
Cost Group
→ Nature
→ COA/calculated line
→ source/calculation lineage
```

## 3. Upload & Proses

This is the main Engine 1 operational workspace.

### 3.1 Upload form

Required fields:

```text
Company Code      [2000 / 7000]
Fiscal Year
Fiscal Period
Source Workbook
```

Optional:

```text
Upload Note
```

There is no META sheet requirement.

Primary action:

```text
Validate & Upload
```

### 3.2 After upload

Show processing stages:

```text
File received
→ Sheet detection
→ Parsing
→ Source validation
→ CC Group reconciliation
→ Mapping validation
→ Ready for calculation
```

Display per logical source:

```text
Source
Detected Sheet
Detail Rows
Detail Total
Reported Total
Difference
Status
```

### 3.3 Exceptions

Show blocking/non-blocking issues with clear action.

Examples:

```text
Missing required source
Period mismatch
Invalid amount
CC Group not reconciled
Unmapped COA
```

Unmapped COA action:

```text
Resolve Mapping
```

Fields:

```text
Company
Cost Group
Nature
Effective From
Note
```

or controlled exclusion with reason.

## 4. Calculation Review

After source validation passes, user starts Engine 1 calculation.

Header:

```text
Company
Period
Upload Version
Calculation Run
Run Status
```

Tabs/sections according to scope:

Company 2000:

```text
ADUM | PASAR
```

Company 7000:

```text
HPP | ADUM | PASAR
```

For each Cost Group show:

```text
Nature
Base Amount
Adjustment
Final Amount
Calculation Type
Status
```

Nature drill-down shows COA composition or formula lineage.

## 5. HPP Review — Company 7000

Show Total HPP formula visibly:

```text
Account Group 5 Total
Less: COGS Mortar
-----------------
Total HPP
```

Show HPP Nature table including Selisih Persediaan.

Selisih Persediaan drill-down:

```text
Total HPP
Less: subtotal Nature before Selisih Persediaan
----------------------------------------------
Selisih Persediaan
```

Control block:

```text
Total HPP
Sum all HPP Nature
Difference
Reconciliation Status
```

Difference must be zero to proceed.

## 6. Finalize Cost Structure

Readiness checklist:

```text
✓ Mandatory sources complete
✓ No blocking validation errors
✓ CC Group source controls reconciled
✓ Unmapped amount = 0
✓ Calculation successful
✓ Cost Group reconciliation passed
✓ HPP reconciliation passed [7000]
```

When ready:

```text
Finalize Cost Structure
```

After finalization, Engine 1 result becomes historical source for Engine 2.

Replacing the source after finalization requires controlled reopen.

## 7. Cost Structure Bulanan

Read-only/final result view by default.

Filters:

```text
Company
Period
Cost Group
Nature
COA
```

Views:

- Summary;
- HPP when applicable;
- ADUM;
- PASAR;
- COA Detail;
- Reconciliation;
- Source Trace.

Primary action:

```text
Export Excel
```

## 8. Riwayat Periode

Table:

```text
Company
Period
Upload Version
Calculation Run
Cost Structure Status
Finalized By
Finalized At
Fluctuation Review Status
Actions
```

Actions may include:

```text
Open
Download Cost Structure
View Upload History
View Audit Trail
Reopen [authorized only]
```

## 9. Analisis Fluktuasi

Purpose: answer `what changed and why?`

Filters:

```text
Company
Period
Comparison: MoM / YoY / YTD
Cost Group: All / HPP / ADUM / PASAR
View: Nature / COA
```

Comparison labels must be explicit, e.g.:

```text
MoM: Jul-2026 vs Jun-2026
YoY: Jul-2026 vs Jul-2025
YTD: Jan-Jul-2026 vs Jan-Jul-2025
```

## 10. Fluctuation table

Columns:

```text
Group/Nature/COA
Comparison Amount
Current Amount
Variance
Variance %
Contribution
Materiality
Commentary Status
```

Missing comparison data shows `Data unavailable`, not zero.

Zero denominator shows N/M for percentage when appropriate.

## 11. Fluctuation dashboard

KPI:

```text
Current Cost
Variance Amount
Variance %
Material Variances
Explained
Outstanding Commentary
```

Recommended visuals:

- top increases;
- top decreases;
- variance waterfall;
- monthly trend;
- contribution ranking;
- optional heatmap after core functionality is stable.

## 12. Commentary workflow

Selecting a material row opens analytical context:

```text
Current
Comparison
Variance
Variance %
Contribution
Trend
Underlying contributors
```

Commentary editor is separate for:

```text
MoM
YoY
YTD
```

Actions for preparer:

```text
Save Draft
Submit
```

Reviewer actions:

```text
Return with note
Review/Approve
```

## 13. Engine 2 export

Primary action:

```text
Export Fluctuation Excel
```

Output sections:

```text
Executive Summary
MoM
YoY
YTD
HPP Detail [7000]
ADUM Detail
PASAR Detail
Commentary
```

## 14. Reopen flow

Authorized user opens finalized period and selects:

```text
Reopen Period
```

Reason is mandatory.

Effects:

- audit log created;
- period leaves immutable state;
- replacement upload/new calculation run may proceed;
- previous finalized run remains in history;
- Engine 2 analysis is refreshed only after new Engine 1 result is finalized.

## 15. UX principles

- Always show Company and Period context on operational/analytical pages.
- Never allow direct editing of calculated accounting values.
- Distinguish Source Control from Final Cost Structure Control.
- Use status/icon/text, not color alone, for reconciliation states.
- Every material total should support lineage drill-down.
- Existing SIG ACTIVA visual language should be reused; do not create an unrelated design system.
