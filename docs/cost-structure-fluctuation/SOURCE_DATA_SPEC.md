# Source Data Specification V2

## 1. Input transaction

The user uploads one Excel workbook for one company and one fiscal period.

Metadata is entered in the application before file upload.

Required form fields:

```text
Company Code
Fiscal Year
Fiscal Period
Source Workbook
```

Optional:

```text
Upload Note
```

There is no META worksheet.

## 2. Metadata authority

The upload form is authoritative for:

- company;
- fiscal year;
- fiscal period.

If a source sheet includes its own period/year/company metadata, the parser uses it only as a cross-check.

A detected source mismatch is a blocking validation error.

## 3. Workbook principle

The workbook contains all current-month raw data necessary to reproduce the monthly Cost Structure calculation without external Excel links.

The application must not depend on:

- linked workbooks on a user's local drive;
- hidden historical formulas;
- row positions that can change between SAP exports;
- monthly copies of master COA mapping.

System mappings and rule identifiers are stored in the application database.

## 4. Logical source sheets — Company 2000

Current target logical sources:

```text
TB
CC_PROD
CC_ADUM
CC_PASAR
ADJUSTMENT         optional
```

The actual accepted sheet names may use aliases configured by the parser, but every logical source must be uniquely detectable.

### 4.1 TB

Purpose:

- source/control data required by the validated 2000 workbook process;
- account-level reconciliation/control where applicable.

Minimum normalized fields depend on the SAP export but should identify account and amount reliably.

### 4.2 CC_PROD

Purpose:

- Production Cost Center Group source where existing allocation/reclassification logic requires it.

Minimum normalized fields:

```text
COA
COA Description
Actual Amount
```

Plus reported CC Group total or sufficient source information to identify that total.

### 4.3 CC_ADUM

Purpose:

- raw ADUM Cost Center Group data.

Minimum normalized fields:

```text
COA
COA Description
Actual Amount
```

Control requirement:

```text
Sum detail per COA = reported CC Group total
```

### 4.4 CC_PASAR

Purpose:

- raw PASAR Cost Center Group data.

Minimum normalized fields:

```text
COA
COA Description
Actual Amount
```

Control requirement:

```text
Sum detail per COA = reported CC Group total
```

### 4.5 ADJUSTMENT

Optional controlled adjustment source.

Recommended standardized columns:

```text
Cost Group
Nature
COA
Amount
Reason
Reference
```

Blank sheet/no rows means no adjustment.

## 5. Logical source sheets — Company 7000

Company 7000 uses the same general CC Group sources plus HPP/supporting sources needed by existing validated formulas.

Current target logical sources:

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
ADJUSTMENT         optional
```

Before parser implementation, each logical source must be cross-checked against the golden 7000 workbook and its exact column/header variants documented in parser tests.

### 5.1 TB

Primary purposes:

- account-group-5 data for Total HPP;
- COGS Mortar exclusion;
- additional existing workbook controls as validated.

Total HPP rule consumes normalized TB account data, not fixed Excel row numbers.

### 5.2 CC_PROD

Production Cost Center Group source used in Cost Structure formation.

Control:

```text
Sum detail per COA = reported CC Group total
```

### 5.3 CC_ADUM

ADUM Cost Center Group source.

Control:

```text
Sum detail per COA = reported CC Group total
```

### 5.4 CC_PASAR

PASAR Cost Center Group source.

Control:

```text
Sum detail per COA = reported CC Group total
```

### 5.5 CC_WHRPG

Supporting Cost Center Group source used by validated existing 7000 allocation/reclassification logic.

It must be uploaded as raw source, not as a formula link to another workbook.

Control where a reported group total is present:

```text
Sum detail per COA = reported CC Group total
```

### 5.6 COAL

Raw source required by the validated Batubara/Batubara Inbound calculation.

Exact columns must be locked from the golden workbook during parser implementation. Typical logical fields may include material/quantity/SAP amount/price/exchange-rate inputs only where they are actually used by the validated formula.

Do not invent or simplify the formula based on assumed columns.

### 5.7 CLINKER_PURCHASE

Source used by the validated Pembelian Terak calculation where applicable.

Exact columns are locked from the golden source before coding.

### 5.8 SOLAR_PP_ORDER

Supporting raw source used by validated existing calculation rules where applicable.

Exact dependency and columns must be verified against the golden workbook before implementation.

### 5.9 OA_STAT

Supporting/statistical source required by validated OA calculation.

OA remains under PASAR.

Exact columns and relationship to CC_PASAR must be locked through golden workbook tests.

### 5.10 ADJUSTMENT

Same controlled optional adjustment format as company 2000.

## 6. Sheet-name strategy

Do not make business logic depend on a single exact human sheet name when SAP exports may vary slightly.

Recommended implementation:

- stable logical source code in application;
- list of accepted aliases/header fingerprints per source parser;
- reject ambiguity when more than one sheet matches the same required logical source.

Example logical codes:

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
ADJUSTMENT
```

## 7. Required vs optional sources

Required-source configuration is company-specific and effective-dated.

A missing required source blocks Engine 1 calculation.

An optional source may be absent only if the applicable rule does not require data for that period.

Do not silently replace a missing required source with zero.

## 8. Normalization rules

Each parser normalizes source records into server-side staging data.

Minimum lineage fields:

```text
Upload ID
Logical Source Code
Original Sheet Name
Source Row Number
COA raw/normalized when applicable
Description raw
Amount raw
Amount normalized
Additional rule-specific normalized values
```

Preserve raw text for audit/debugging.

## 9. Amount parsing

Support accounting representations such as:

```text
1500000
1,500,000
1.500.000
(1,500,000)
1,500,000-
-1500000
```

The parser must know the source format/locale and produce an exact Decimal-compatible value.

Do not use JavaScript Float as the authoritative normalized financial value.

## 10. COA handling

COA is a string identifier.

Never coerce it to integer in a way that can remove leading zeroes.

For each applicable source row:

```text
COA source
→ COA master
→ Company/Cost Group/Nature mapping
```

Unknown COA becomes an explicit validation/mapping issue.

## 11. CC Group total extraction

Each CC Group parser must define how the source-reported group total is detected.

The control is:

```text
Normalized detail total - reported source total = 0
```

The parser must not include total/subtotal rows twice in detail aggregation.

Parser tests must cover source header/footer variations.

## 12. Duplicate upload handling

Compute SHA-256 of the uploaded workbook.

If the same company/year/period file hash already exists, warn/block duplicate upload according to workflow.

Replacement upload creates a new version; it does not overwrite source history silently.

## 13. Version rule

For one company and period:

```text
Upload v1 → superseded
Upload v2 → active
```

Historical upload metadata remains available.

Any finalized period replacement requires controlled reopen/unlock and recalculation.

## 14. Source validation levels

### File-level errors

Examples:

- unreadable workbook;
- unsupported file type;
- required source sheet missing;
- ambiguous source sheet detection.

### Metadata cross-check errors

Examples:

- detected source year differs from selected year;
- detected source period differs from selected period;
- detected company differs from selected company.

### Data-level errors

Examples:

- invalid amount;
- missing COA where required;
- CC Group detail does not reconcile;
- duplicate source rows that violate source specification;
- unknown mapping.

## 15. Output of source stage

The source stage does not yet represent Final Cost Structure.

It produces validated, reconciled, traceable input datasets for the calculation layer.

A raw CC_ADUM total may differ from final ADUM after validated allocation/reclassification logic. Source reconciliation and final Cost Group reconciliation are separate controls.

## 16. Golden-source requirement

Before coding each parser:

1. inspect the supplied existing source workbook;
2. document the exact relevant sheets/header patterns;
3. create parser fixtures from representative rows;
4. identify total/subtotal handling;
5. prove normalized totals match the existing source;
6. only then implement downstream accounting calculation.

This document describes the logical contract. Exact parser aliases and columns become test-locked implementation details after golden workbook verification.


## Engine 2 V2 analysis bases (2026-08-31)

Engine 2 derives only from a FINALIZED period and its active SUCCESS calculation run/upload. Company 2000 has one `SI` analysis basis (final Engine 1 V2 detail independently controlled against `AUDIT_SI`). Company 7000 has separate additive `GHOPO` and `DERIV` analysis bases: GHOPO retains finalized Engine 1 detail and is controlled against `AUDIT_GHOPO`; DERIV is parsed from `AUDIT_DERIV` on that same upload in Rp-thousand and normalized to full IDR. DERIV remains excluded from Company 7000 Engine 1 and is never a Cost Group.

The hierarchy and stable identity are Company -> Analysis Basis -> Cost Group -> Nature -> COA/calculated item. Keys are basis-qualified (`basis:<BASIS>:group:<id>:nature:<id>:...`) and monthly run/upload identity remains lineage, not node identity. All parity uses Decimal normalization to two financial decimal places. Missing source controls and non-reconciling finalized sources are integrity failures, while missing comparison periods remain `UNAVAILABLE`.

PR #23 remains HOLD. Its Phase I assumptions about legacy unqualified analysis keys are superseded; after Engine 2 V2 merges, Phase I must be rebased and adapted separately. Phase I materiality, commentary, and review are not part of this redesign.
