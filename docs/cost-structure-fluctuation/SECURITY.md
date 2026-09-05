# Security & Authorization V2

## 1. Existing auth foundation

Reuse SIG ACTIVA custom session authentication and existing `UserRole` model.

Do not introduce a second authentication system for this module.

Do not expose Prisma/database credentials to the browser.

## 2. Existing roles

Current repository roles include:

```text
ADMIN_SYSTEM
STAFF_ACCOUNTING
SUPERVISOR_ACCOUNTING
AUDITOR_INTERNAL
STAFF_PRODUCTION
```

The module should use these existing identities and add module-specific authorization helpers.

## 3. Recommended module permissions

### Read

Baseline authorized readers:

```text
ADMIN_SYSTEM
STAFF_ACCOUNTING
SUPERVISOR_ACCOUNTING
AUDITOR_INTERNAL
STAFF_PRODUCTION
```

If business owners later restrict company/group visibility, add explicit module access configuration without weakening server checks.

### Prepare/write

```text
ADMIN_SYSTEM
STAFF_ACCOUNTING
```

Capabilities:

- upload workbook;
- resolve allowed mapping issues;
- create explicit adjustments where permitted;
- run Engine 1 calculation;
- prepare commentary.

### Review/finalize

```text
ADMIN_SYSTEM
SUPERVISOR_ACCOUNTING
```

Capabilities:

- review calculation readiness;
- finalize Cost Structure;
- return/review commentary;
- approve analytical review according to final workflow.

### Administration

```text
ADMIN_SYSTEM
```

Capabilities:

- maintain module masters;
- materiality configuration;
- reopen finalized periods;
- user/module access configuration if added.

## 4. Server-side authorization helpers

Add helpers dedicated to the new module, for example:

```text
requireCostRead()
requireCostPrepare()
requireCostReview()
requireCostAdmin()
```

Do not globally broaden `requireFinanceWrite()` or other existing helpers merely to support this module.

Every write API must enforce authorization server-side.

UI hiding/disabled buttons are not a security control.

## 5. Maker/checker

Where practical:

```text
preparer != reviewer
```

should be enforced for material commentary/final review.

If `ADMIN_SYSTEM` override is allowed, it must be explicit and audited.

## 6. Period immutability

When Engine 1 period is `FINALIZED`:

Normal write operations must reject:

- upload replacement;
- mapping changes applied retroactively to that run;
- adjustment changes;
- rerun activation;
- manual changes to Cost Actual lines.

Reopen requires authorized role and mandatory reason.

## 7. Calculated data protection

No API should provide a generic endpoint that lets a client set:

```text
finalAmount
Total HPP
Selisih Persediaan
MoM/YoY/YTD calculated value
```

Calculated data is written only by trusted domain services.

Corrections flow through source/mapping/adjustment and a new calculation run.

## 8. Upload security

Validate:

- accepted Excel MIME/extension;
- maximum upload size;
- workbook readability;
- number of sheets/rows within configured limits;
- malicious/unexpected workbook content handling.

Do not execute workbook macros.

Do not evaluate arbitrary workbook formulas as server code.

The parser reads data and the application executes its own validated accounting rules.

## 9. File storage

Original workbook must be stored in approved durable storage.

Storage key must not be directly user-controlled.

Store SHA-256 and ownership metadata.

Download endpoints must re-check authorization before returning source files or generated reports.

## 10. Formula injection in Excel export

When exporting user-provided text to Excel, sanitize cells beginning with dangerous spreadsheet formula prefixes where the text is meant to remain text, including values beginning with:

```text
=
+
-
@
```

Do not allow commentary/source text to become unintended formulas.

## 11. Audit logging

Material actions must log user, time, object and relevant before/after context.

Minimum actions:

```text
UPLOAD
REPLACE_UPLOAD
RESOLVE_MAPPING
EXCLUDE_COA
CREATE/UPDATE_ADJUSTMENT
RUN_CALCULATION
FINALIZE_PERIOD
REOPEN_PERIOD
SUBMIT_COMMENTARY
RETURN_COMMENTARY
REVIEW_COMMENTARY
CHANGE_MASTER
CHANGE_MATERIALITY
EXPORT_SOURCE/REPORT when needed
```

Audit log is append-only through normal user workflows.

## 12. Sensitive data

Cost Structure source/report data is finance data.

Do not expose source rows through unauthenticated/public endpoints.

API responses should return only fields required by the screen/use case.

## 13. API input validation

Validate all route inputs with explicit schemas/guards:

- IDs;
- company;
- fiscal year/period;
- pagination/filter values;
- adjustment/commentary text;
- file metadata.

Never trust client-provided role or uploader identity. Resolve user from verified session.

## 14. Database transactions

Use database transactions for operations that must remain consistent, such as:

- activating replacement upload and superseding prior version;
- completing calculation run and switching active run;
- finalization state + audit entry;
- controlled reopen state + audit entry.

## 15. Existing-module regression

Security changes for this module must not weaken:

- Accrual authorization;
- Prepaid authorization;
- Material authorization;
- existing Fluktuasi OI/EXP authorization;
- User Management/Security routes.

Run regression checks before merge.
