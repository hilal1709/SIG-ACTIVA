# Business Rules V2 — Cost Structure & Fluktuasi Biaya

## 1. Product boundary

The module is part of SIG ACTIVA and consists of two accounting/analysis engines with a strict dependency:

```text
Monthly source workbook
        ↓
ENGINE 1 — MONTHLY COST STRUCTURE
        ↓
FINALIZED COST STRUCTURE HISTORY
        ↓
ENGINE 2 — FLUCTUATION ANALYSIS
```

Engine 2 may not use raw upload data as its authoritative source.

## 2. Company scope

### Company 2000

Cost groups:

- ADUM
- PASAR

### Company 7000

Cost groups:

- HPP
- ADUM
- PASAR

### Explicit exclusion

> **Superseded for Company 2000 (2026-08-31):** the blanket derivative exclusion below is
> historical. `ENGINE1_2000_V2` reconstructs SI from mapped CC detail, COA-level Rincian
> corrections, and negative CC_DRV detail classified through the PASAR SI mapping.

Derivatif is out of scope for both companies.

It must not be included in:

- source calculation;
- Cost Structure output;
- historical actuals;
- fluctuation analysis;
- dashboard;
- Excel export.

## 3. Upload business rule

The monthly process uses one Excel workbook per company and fiscal period.

Before upload the user fills application fields:

- Company Code — required.
- Fiscal Year — required.
- Fiscal Period — required.
- Upload Note — optional.
- Source Workbook — required.

No `META` worksheet is required or allowed as a dependency.

If source sheets themselves contain period/year metadata, the parser may use it as a validation cross-check. The application form remains the transaction metadata authority.

## 4. Source workbook principle

The workbook contains raw/current-month data sheets needed to reproduce the existing cost-structure calculation.

System master data, including COA-to-nature mappings, is not uploaded every month.

External Excel links and hidden historical formulas are not valid dependencies for the new engine. Required external inputs must be included as explicit source sheets or system master/configuration.

## 5. Engine 1 objective

Engine 1 replaces the manual monthly Cost Structure workbook formation process.

It must:

1. receive the source workbook;
2. parse and normalize source data;
3. validate source completeness;
4. reconcile CC Group totals;
5. resolve COA mappings;
6. execute validated existing formulas;
7. calculate HPP/ADUM/PASAR according to company scope;
8. reconcile final Cost Structure;
9. finalize a period;
10. create a dashboard;
11. export an Excel report in a format comparable to the existing Cost Structure report.

## 6. Source CC Group control

For every Cost Center Group source:

```text
Sum of detail amount per COA
=
Reported CC Group total
```

Difference must be zero before source data can proceed to monthly calculation.

This is a source-completeness control and is distinct from final Cost Group reconciliation after allocation/reclassification/formulas.

## 7. Mapping completeness control

Every validated source amount must have an explicit disposition:

```text
Mapped
+ Explicitly Excluded
+ Reclassified/Allocated
=
Validated Source
```

No amount may disappear silently.

An unknown COA becomes `UNMAPPED`, not zero.

A new COA must be:

- mapped to the appropriate Cost Group/Nature; or
- explicitly excluded with a documented reason.

## 8. Monthly nature control

For normal mapped natures:

```text
Nature Total = Sum of underlying COA detail
```

For formula/residual natures, the system must show calculation lineage rather than invent a dummy COA.

## 9. Final Cost Group control

After calculation:

```text
ADUM Total = Sum of ADUM natures
PASAR Total = Sum of PASAR natures
HPP Total = Sum of HPP natures   [7000 only]
```

All reconciliation differences must equal zero before finalization.

## 10. Company 2000 calculation principle

Company 2000 uses the validated existing workflow for forming:

- ADUM;
- PASAR.

The engine uses source CC Group detail, system mapping and any validated existing allocation/reclassification rules required by the reference workbook.

There is no HPP Cost Group in company 2000 scope.

### 10.1 Locked SI V2 contract

`raw mapped CC + (Rincian by COA - raw CC by COA) = Rincian base`; CC_DRV eight-digit detail is
then a negative PASAR contribution. Subtotals and Grand Total do not contribute, and detail must
reconcile to the persisted Grand Total. The final persisted Engine 1 result is SI. PASAR category-67
tax/retribution maps to N07 (UUA), while source-specific ADUM mapping remains N09.

For future Engine 2 work, “7000 DERIV excluded” is superseded. The locked direction is Company 2000
basis = final SI and Company 7000 basis = persisted GHoPO + DERIV. The 7000 Phase H refactor is
pending a separate implementation/review and is not implemented here.

## 11. Company 7000 calculation principle

Company 7000 uses the same general source-to-Cost-Structure flow as company 2000 but additionally includes HPP.

### 11.1 Total HPP

Authoritative formula:

```text
Total HPP
=
Total cost of account group 5
-
Account-group-5 COGS Mortar
```

Do not calculate Total HPP by simply adding detail natures first.

The COGS Mortar account must be identified through an explicit master/rule mapping, not an Excel row number.

### 11.2 HPP natures

HPP natures follow the validated existing workbook structure, including, where applicable:

- Bahan Baku;
- Bahan Penolong;
- Kemasan;
- Batubara;
- Batubara Inbound;
- Bahan Bakar Lainnya;
- Energi/Listrik;
- Tenaga Kerja;
- Pemeliharaan;
- Penyusutan & Amortisasi;
- Umum & Administrasi;
- Perniagaan;
- Pajak & Asuransi;
- Pembelian Terak;
- Ongkos Angkut FG/WIP;
- Selisih Persediaan.

Final names/order must match the validated reference workbook/master.

### 11.3 Batubara

Batubara and related split/components follow the validated existing workbook formula.

The application may restructure the code, but it must not alter the accounting result.

### 11.4 Selisih Persediaan

Selisih Persediaan is a residual calculated item:

```text
Selisih Persediaan
=
Total HPP
-
Sum of all HPP natures from Bahan Baku through the final nature before Selisih Persediaan
```

Consequently:

```text
Sum of all HPP natures = Total HPP
```

must reconcile exactly.

## 12. OA rule

OA follows the validated existing workbook formula.

Business hierarchy:

```text
7000
└── PASAR
    └── OA
```

OA is not a fourth Cost Group.

PASAR total includes OA according to the validated existing report logic.

## 13. Adjustment rule

If a monthly adjustment is required, it must be explicit and traceable.

Minimum information:

- Cost Group;
- Nature;
- COA when applicable;
- Amount;
- Reason;
- Reference;
- User and timestamp.

Do not hide adjustments inside opaque formulas.

## 14. Final Cost Structure

Once Engine 1 passes all controls, it creates a finalized monthly Cost Structure dataset with the hierarchy:

```text
Company
  ↓
Fiscal Period
  ↓
Cost Group
  ↓
Expense Nature
  ↓
COA / calculated item
```

Finalized data is the authoritative historical actual used by Engine 2.

Calculated final amounts are not manually editable.

## 15. Engine 1 finalization lifecycle

Recommended statuses:

```text
UPLOADED
→ SOURCE_VALIDATION
→ SOURCE_RECONCILED
→ CALCULATED
→ COST_STRUCTURE_RECONCILED
→ FINALIZED
```

A period may be finalized only when all mandatory controls pass.

## 16. Engine 1 output

### Dashboard Cost Structure

Must support at minimum:

- Company and Period filters;
- Total Cost;
- HPP/ADUM/PASAR according to company scope;
- Cost composition by Nature;
- source reconciliation status;
- unmapped COA count;
- HPP reconciliation status for company 7000;
- period status;
- drill-down to Nature, COA and source lineage.

### Excel export

Engine 1 exports a system-generated Cost Structure workbook from the database, not by copying the source file.

Expected logical sections:

Company 2000:

- Summary;
- ADUM;
- PASAR;
- COA Detail;
- Reconciliation;
- Source Trace.

Company 7000:

- Summary;
- HPP;
- ADUM;
- PASAR;
- COA Detail;
- Reconciliation;
- Source Trace.

## 17. Engine 2 objective

Engine 2 analyzes only finalized Engine 1 historical data.

It must provide:

- MoM;
- YoY;
- YTD;
- variance amount;
- variance percentage;
- contribution to total movement;
- materiality status;
- commentary;
- review workflow;
- dashboard;
- Excel export.

## 18. Comparison definitions

For selected month M of year Y:

### MoM

```text
M/Y vs previous calendar month
```

January must compare to December of the previous year.

### YoY

```text
M/Y vs same month Y-1
```

### YTD

```text
Jan–M/Y vs Jan–M/Y-1
```

## 19. Missing vs zero

Missing historical data is not zero.

If a required comparison period has not been finalized, the system returns a comparison-unavailable state rather than calculating against zero.

## 20. Variance percentage

When comparison amount is non-zero:

```text
Variance % = (Current - Comparison) / ABS(Comparison)
```

When comparison amount is zero and current is non-zero, percentage is N/M using null/status semantics.

## 21. Materiality

Materiality determines whether explanation is required; it does not alter accounting amounts.

Rules should be configurable by Company, Cost Group and Comparison Type where needed.

## 22. Commentary

Commentary is separate for:

- MoM;
- YoY;
- YTD.

Reason may be entered at Nature level and optionally COA level.

Commentary never changes calculated amounts.

## 23. Review lifecycle

Recommended commentary states:

```text
OPEN
→ DRAFT
→ SUBMITTED
→ REVIEWED
```

Reviewer may return a submission:

```text
SUBMITTED → RETURNED → DRAFT
```

Maker/checker metadata must be preserved.

## 24. Engine 2 dashboard

The Fluctuation dashboard answers what changed and why.

Minimum content:

- Current Cost;
- MoM/YoY/YTD variance;
- Top increases;
- Top decreases;
- contribution drivers;
- trend;
- material variance count;
- outstanding commentary count;
- drill-down Company → Cost Group → Nature → COA.

## 25. Engine 2 Excel export

Expected logical sections:

- Executive Summary;
- MoM;
- YoY;
- YTD;
- HPP detail when applicable;
- ADUM detail;
- PASAR detail;
- Commentary.

## 26. Period immutability

Once finalized/locked:

- source cannot be silently replaced;
- calculation cannot be overwritten;
- final actual cannot be manually edited;
- approved commentary cannot be silently changed.

A controlled reopen/unlock requires authorized role, reason and audit logging.

## 27. Golden reconciliation

Reference workbooks supplied for company 2000 and company 7000 are golden test sources.

Implementation is not accepted until the system reproduces validated existing Cost Structure values and specific locked formulas exactly.

Golden values are maintained in tests/documentation after verification against the source workbook. Do not invent expected amounts in code.
