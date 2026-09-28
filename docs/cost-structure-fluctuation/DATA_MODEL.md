# Data Model V2 — Prisma/PostgreSQL Proposal

## 1. Design principles

The new module uses dedicated `Cost*` models and does not repurpose existing `Fluktuasi*` models.

Key principles:

- multi-company;
- period-based history;
- exact source lineage;
- versioned uploads;
- effective-dated mappings;
- versioned calculation runs;
- immutable finalized accounting outputs;
- persisted commentary/review workflow;
- Decimal financial amounts.

## 2. Proposed models overview

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

Existing `User` remains the user/auth authority.

## 3. CostCompany

Purpose: module company master.

Suggested fields:

```text
id              Int/UUID PK
companyCode     String unique
companyName     String
active          Boolean
createdAt
updatedAt
```

Initial seeds:

```text
2000
7000
```

## 4. CostGroup

Purpose: company-specific Cost Group master.

Suggested fields:

```text
id
companyId       FK CostCompany
code            HPP / ADUM / PASAR
name
displayOrder
active
createdAt
updatedAt
```

Unique:

```text
(companyId, code)
```

Initial scope:

```text
2000: ADUM, PASAR
7000: HPP, ADUM, PASAR
```

## 5. CostNature

Purpose: display/calculation hierarchy below Cost Group.

Suggested fields:

```text
id
costGroupId
code
name
calculationType
ruleCode nullable
displayOrder
active
createdAt
updatedAt
```

`calculationType` examples:

```text
MAPPED
FORMULA
RESIDUAL
```

Examples:

- normal mapped nature -> `MAPPED`;
- Batubara/OA when driven by explicit existing formula -> `FORMULA`;
- Selisih Persediaan -> `RESIDUAL`.

## 6. CostCoa

Purpose: account master used by Cost Structure.

Suggested fields:

```text
id
coaCode         String unique
coaDescription  String
accountGroup    String nullable
active
createdAt
updatedAt
```

COA must be stored as String.

## 7. CostCoaMapping

Purpose: effective-dated Company/Cost Group/Nature mapping.

Suggested fields:

```text
id
companyId
costGroupId
natureId
coaId
mappingAction       INCLUDE / EXCLUDE / RECLASS
validFrom           Date
validTo             Date nullable
note                String nullable
active
createdById         FK User
createdAt
updatedAt
```

Important rule:

Do not destructively change old mapping for historical periods. End-date the old mapping and create the new effective version.

Prevent overlapping active mappings for the same intended business key/effective interval at service/database validation level.

## 8. CostPeriod

Purpose: one processing state per company/fiscal period.

Suggested fields:

```text
id
companyId
fiscalYear          Int
fiscalPeriod        Int
periodStart         DateTime
periodEnd           DateTime
status
activeCalculationRunId nullable
finalizedAt nullable
finalizedById nullable
reopenedAt nullable
reopenedById nullable
reopenReason nullable
createdAt
updatedAt
```

Unique:

```text
(companyId, fiscalYear, fiscalPeriod)
```

Recommended Engine 1 states:

```text
NOT_STARTED
UPLOADED
SOURCE_VALIDATION
SOURCE_RECONCILED
CALCULATED
COST_STRUCTURE_RECONCILED
FINALIZED
```

## 9. CostUpload

Purpose: versioned workbook upload transaction.

Suggested fields:

```text
id
periodId
version             Int
originalFileName
fileHashSha256
fileSizeBytes
storageProvider
storageKey
uploadNote nullable
status
isActiveVersion
uploadedById        FK User
uploadedAt
validatedAt nullable
supersededAt nullable
createdAt
updatedAt
```

Unique design target:

- only one active upload version per period;
- duplicate hash detection per relevant scope.

Do not store the file on ephemeral local Vercel disk.

## 10. CostSourceRow

Purpose: normalized staging/raw lineage rows.

Suggested fields:

```text
id
uploadId
logicalSourceCode
originalSheetName
sourceRowNumber
coaCodeRaw nullable
coaId nullable
descriptionRaw nullable
amountRaw nullable
amount             Decimal nullable
sourceGroupRaw nullable
rawDataJson         Json nullable
mappingStatus
createdAt
updatedAt
```

Use:

```text
Decimal @db.Decimal(20, 2)
```

for amount.

`rawDataJson` may store additional rule-specific normalized/raw fields but should not become the only queryable accounting representation.

## 11. CostValidationIssue

Purpose: explicit parser/source/mapping issue register.

Suggested fields:

```text
id
uploadId
sourceRowId nullable
issueCode
severity            INFO / WARNING / ERROR
message
resolved
resolutionType nullable
resolutionNote nullable
resolvedById nullable
resolvedAt nullable
createdAt
updatedAt
```

Examples:

```text
MISSING_SOURCE
PERIOD_MISMATCH
INVALID_AMOUNT
CC_GROUP_NOT_RECONCILED
UNMAPPED_COA
AMBIGUOUS_SHEET
```

## 12. CostAdjustment

Purpose: controlled explicit monthly adjustments.

Suggested fields:

```text
id
periodId
uploadId nullable
costGroupId
natureId
coaId nullable
amount              Decimal
reason
reference nullable
createdById
createdAt
updatedAt
```

Adjustments must be included in calculation lineage.

## 13. CostCalculationRun

Purpose: versioned, reproducible Engine 1 execution.

Suggested fields:

```text
id
periodId
runNumber
uploadId
status              RUNNING / SUCCESS / FAILED
ruleSetVersion
sourceSnapshotJson
mappingSnapshotJson nullable
startedById
startedAt
completedAt nullable
isActive
errorMessage nullable
createdAt
updatedAt
```

A run with identical source/mapping/rule context must be deterministic.

## 14. CostActualLine

Purpose: detailed finalized/calculated Cost Structure line representation.

Suggested grain:

```text
Calculation Run
+ Cost Group
+ Nature
+ COA/calculated item
+ lineage component
```

Suggested fields:

```text
id
calculationRunId
periodId
costGroupId
natureId
coaId nullable
lineType            COA / FORMULA / RESIDUAL / ADJUSTMENT
sourceAmount        Decimal nullable
adjustmentAmount    Decimal
finalAmount         Decimal
ruleCode nullable
sourceRowId nullable
sourceReferenceJson nullable
createdAt
```

Do not force a fake COA for Selisih Persediaan or other calculated items.

## 15. CostCalculationResult

Purpose: aggregate/named results and reconciliation outcomes not naturally represented as a direct COA line.

Suggested fields:

```text
id
calculationRunId
periodId
costGroupId nullable
natureId nullable
resultCode
resultType          TOTAL / NATURE / CONTROL
amount              Decimal
ruleCode nullable
reconciliationDifference Decimal nullable
reconciliationStatus nullable
calculationDetailJson nullable
createdAt
```

Examples:

```text
TOTAL_HPP
TOTAL_ADUM
TOTAL_PASAR
HPP_RECONCILIATION
CC_ADUM_SOURCE_CONTROL
```

## 16. CostMaterialityRule

Purpose: configurable Engine 2 explanation threshold.

Suggested fields:

```text
id
companyId
costGroupId nullable
comparisonType      MOM / YOY / YTD
amountThreshold     Decimal nullable
percentThreshold    Decimal nullable
operator            AND / OR
validFrom
validTo nullable
active
createdById
createdAt
updatedAt
```

Materiality affects workflow only, never accounting amounts.

## 17. CostCommentary

Purpose: Engine 2 explanation workflow.

Suggested fields:

```text
id
periodId
comparisonType      MOM / YOY / YTD
analysisLevel       GROUP / NATURE / COA
costGroupId
natureId nullable
coaId nullable
reason
status              OPEN / DRAFT / SUBMITTED / RETURNED / REVIEWED
preparedById nullable
preparedAt nullable
submittedAt nullable
reviewedById nullable
reviewedAt nullable
reviewerNote nullable
createdAt
updatedAt
```

Unique business identity should prevent duplicate active commentary for the same period/comparison/object.

## 18. CostCommentaryHistory

Purpose: preserve commentary revisions.

Suggested fields:

```text
id
commentaryId
version
reason
status
reviewerNote nullable
changedById
changedAt
```

## 19. CostPeriodReview

Purpose: period-level review/finalization evidence.

Suggested fields:

```text
id
periodId
reviewStatus
reviewedById
reviewedAt
note nullable
createdAt
updatedAt
```

If finalization and analytical review are separated operationally, use separate statuses/checkpoints rather than overloading one flag.

## 20. CostAuditLog

Purpose: material business action audit trail.

Suggested fields:

```text
id
userId
periodId nullable
action
entityType
entityId nullable
oldValueJson nullable
newValueJson nullable
reason nullable
createdAt
```

Log at minimum:

```text
UPLOAD
REPLACE_UPLOAD
RESOLVE_MAPPING
EXCLUDE_COA
CREATE_ADJUSTMENT
RUN_CALCULATION
FINALIZE_PERIOD
REOPEN_PERIOD
SAVE_COMMENTARY
SUBMIT_COMMENTARY
RETURN_COMMENTARY
REVIEW_COMMENTARY
CHANGE_MASTER
CHANGE_MATERIALITY
```

## 21. Finalized historical source for Engine 2

Engine 2 must only query Engine 1 data where:

```text
CostPeriod.status = FINALIZED
```

and the calculation run is the period's active finalized run.

Do not accidentally include superseded or failed calculation runs.

## 22. Relationship outline

```text
User
  │
  ├──── CostUpload / mapping / adjustments / runs / reviews / audit
  │
CostCompany
  │
  ├──── CostGroup
  │       └──── CostNature
  │
  ├──── CostPeriod
  │       ├──── CostUpload
  │       │       ├──── CostSourceRow
  │       │       └──── CostValidationIssue
  │       ├──── CostAdjustment
  │       ├──── CostCalculationRun
  │       │       ├──── CostActualLine
  │       │       └──── CostCalculationResult
  │       ├──── CostCommentary
  │       └──── CostPeriodReview
  │
  ├──── CostCoaMapping ─── CostCoa
  └──── CostMaterialityRule
```

## 23. Index recommendations

At minimum:

```text
CostPeriod(companyId, fiscalYear, fiscalPeriod)
CostUpload(periodId, isActiveVersion)
CostSourceRow(uploadId, logicalSourceCode)
CostSourceRow(coaId)
CostCoaMapping(companyId, coaId, validFrom, validTo)
CostCalculationRun(periodId, isActive)
CostActualLine(periodId, costGroupId, natureId)
CostActualLine(coaId)
CostCommentary(periodId, comparisonType, status)
CostAuditLog(periodId, createdAt)
```

## 24. Financial type rule

All new amount/threshold/reconciliation columns use Decimal/numeric.

Do not copy legacy `Float` choices into this module.

## 25. Migration discipline

Implement schema additions through Prisma migrations.

Never edit or drop existing `Fluktuasi*`, Accrual, Prepaid, Material or User tables as part of initial Cost Structure migration.

Seed module masters separately and make seed operations idempotent.
