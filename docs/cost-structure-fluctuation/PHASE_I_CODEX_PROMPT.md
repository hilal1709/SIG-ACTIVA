# CODEX FULL-CONTEXT PROMPT — PHASE I
## Materiality, Commentary & Review Workflow

Repository:

`hudavariausaha/SIG-ACTIVA`

Target branch:

`feat/phase-i-materiality-commentary-review`

Do not work on old Phase H branches.

Phase H is complete and production deployed. The Phase H implementation was merged through PR #21 and the production closeout through PR #22.

Latest known Phase H implementation merge:

`bda33573b4a8c11fc454e40b42b2fa2471fe4a2a`

Phase H production closeout main commit:

`3eedfe5120a11d586506a34ccd83f5464e5d0ba3`

Your task is to implement **Phase I — Materiality, Commentary and Review** completely on this branch, validate it, document it, generate the additive schema migration required for Phase I, and open a Pull Request for review.

Do **not** merge the PR automatically.

Do **not** apply the new migration to production Supabase from Codex. Production DDL is applied only after external review through the controlled Supabase migration workflow.

---

# 0. MANDATORY PREFLIGHT

Before modifying code, read:

- `AGENTS.md`
- `README.md`
- `docs/cost-structure-fluctuation/PROJECT_BLUEPRINT.md`
- `docs/cost-structure-fluctuation/BUSINESS_RULES.md`
- `docs/cost-structure-fluctuation/ARCHITECTURE.md`
- `docs/cost-structure-fluctuation/DATA_MODEL.md`
- `docs/cost-structure-fluctuation/CALCULATION_RULES.md`
- `docs/cost-structure-fluctuation/UI_FLOW.md`
- `docs/cost-structure-fluctuation/SECURITY.md`
- `docs/cost-structure-fluctuation/TEST_CASES.md`
- `docs/cost-structure-fluctuation/DEVELOPMENT_PLAN.md`
- `docs/cost-structure-fluctuation/DATABASE_RUNTIME.md`
- `docs/cost-structure-fluctuation/PROJECT_STATUS.md`
- `docs/cost-structure-fluctuation/PHASE_H_COMPARISON_ENGINE.md`
- `docs/cost-structure-fluctuation/PHASE_H_CODEX_PROMPT.md`

Inspect current implementation under:

- `lib/cost-structure/**`
- `lib/cost-fluctuation/**`
- `app/api/cost-structure/**`
- `app/api/cost-fluctuation/**`
- `app/cost-fluctuation/**`
- `app/cost-structure/**`
- `prisma/schema.prisma`
- current Cost Structure authorization helpers
- current audit logging patterns
- current test runner

Do not assume proposed model documentation already exists in Prisma. Inspect the actual schema first.

---

# 1. CURRENT PRODUCTION GATE — LOCKED

Phase A through H are complete.

Current status:

```text
Phase A — COMPLETE
Phase B — COMPLETE / production DDL applied
Phase C — COMPLETE
Phase D — COMPLETE
Phase E — COMPLETE / Company 2000 production golden pass
Phase F — COMPLETE / Company 7000 production golden pass
Phase G — COMPLETE / production UAT pass
Phase H — COMPLETE / production deployed
Phase I — IMPLEMENT NOW
Phase J — NOT STARTED
Phase K — NOT STARTED
```

Phase I must not change Phase E/F/G/H financial behavior.

Production currently contains only July-2026 finalized Cost Structure periods:

```text
Company 2000 — Period ID 1 — FINALIZED — active Run 1 SUCCESS
Company 7000 — Period ID 2 — FINALIZED — active Run 8 SUCCESS
```

Therefore production does not yet have enough finalized historical months for a real AVAILABLE July-2026 MoM/YoY/YTD comparison. This is expected.

Do not seed fake production historical accounting periods merely to test Phase I.

Synthetic tests must cover AVAILABLE comparison workflows.

---

# 2. ARCHITECTURAL BOUNDARY — NON-NEGOTIABLE

Phase I sits **on top of Phase H**.

The dependency remains:

```text
FINALIZED Engine 1 history
        ↓
Phase H Engine 2 comparison
        ↓
Phase I materiality
        ↓
Phase I commentary / review
```

Phase I may never:

- recalculate Engine 1;
- parse/download source workbooks;
- use `CostSourceRow` as authoritative analytical input;
- change Engine 2 amounts;
- overwrite variance amounts or percentages;
- overwrite finalized `CostActualLine` or `CostCalculationResult`;
- create a second fluctuation calculation engine;
- use legacy `Fluktuasi*` models.

Materiality is workflow metadata only.

Commentary is explanation only.

Review is workflow evidence only.

Accounting and Engine 2 analytical amounts remain immutable.

---

# 3. EXISTING AUTHORIZATION — REUSE IT

Existing module roles are:

```text
Read:
ADMIN_SYSTEM
STAFF_ACCOUNTING
SUPERVISOR_ACCOUNTING
AUDITOR_INTERNAL
STAFF_PRODUCTION

Prepare/write:
ADMIN_SYSTEM
STAFF_ACCOUNTING

Review:
ADMIN_SYSTEM
SUPERVISOR_ACCOUNTING

Admin:
ADMIN_SYSTEM
```

Reuse the existing helpers where appropriate:

```text
requireCostStructureRead
requireCostStructurePrepare
requireCostStructureReview
requireCostStructureAdmin
```

A thin Cost Fluctuation wrapper is acceptable, but do not broaden global role helpers.

Every mutation must check authorization server-side.

UI hiding is not authorization.

---

# 4. PHASE I DATABASE MODELS

Phase I is expected to add the persisted workflow models proposed in project documentation:

```text
CostMaterialityRule
CostCommentary
CostCommentaryHistory
CostPeriodReview
```

The exact Prisma implementation may evolve to satisfy the locked workflow below, but remain additive.

Do not modify/drop legacy tables.

Do not repurpose `Fluktuasi*` models.

All monetary/threshold values use Decimal/numeric, never Float.

## 4.1 CostMaterialityRule

Required business fields at minimum:

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

Recommended DB precision:

```text
amountThreshold  Decimal @db.Decimal(20,2)
percentThreshold Decimal @db.Decimal(20,6)
```

Validation:

- at least one of amountThreshold / percentThreshold must be configured;
- thresholds must be >= 0;
- `validTo`, if present, must not precede `validFrom`;
- rule scope is Company + optional Cost Group + Comparison Type + effective interval;
- overlapping simultaneously applicable active rules for the same exact scope must be rejected by service validation;
- ambiguous rule resolution must fail loudly rather than picking an arbitrary row.

Materiality configuration is ADMIN_SYSTEM only.

Do not hard-code business threshold values in code, seed, or migration.

There is currently no locked production amount/percentage threshold. Admin configuration is the source of threshold values.

## 4.2 CostCommentary

Persist commentary workflow, not analytical amounts.

Required fields/concepts:

```text
id
periodId
comparisonType
analysisLevel
analysisKey
costGroupId
natureId nullable
coaId nullable
calculatedItemKey nullable
analysisLineageKey
reason
status
preparedById nullable
preparedAt nullable
submittedAt nullable
reviewedById nullable
reviewedAt nullable
reviewerNote nullable
createdAt
updatedAt
```

Analysis levels must support at least:

```text
COST_GROUP
NATURE
COA
CALCULATED_ITEM
```

Do not create fake COAs for calculated/residual items.

Use the stable Phase H analytical identity for `analysisKey`.

Examples:

```text
group:<costGroupId>
nature:<natureId>
coa:<coaId>
calculated:<natureId>:<lineType>:<ruleCode>
```

The server must derive/validate the analytical identity from the current Phase H hierarchy. Do not trust a client-supplied arbitrary key.

`analysisLineageKey` must bind the commentary to the exact Engine 2 lineage used when the commentary was prepared.

Generate it deterministically on the server from the Phase H current/comparison lineage (period IDs, run IDs, rule-set versions, comparison type) using a stable serialization + SHA-256 or equivalent deterministic digest.

This prevents an old commentary from silently being reused after a Cost Structure period is reopened/re-finalized onto different active run lineage.

Recommended unique business identity:

```text
(periodId, comparisonType, analysisKey, analysisLineageKey)
```

If Prisma null semantics make a composite FK-based uniqueness rule unsafe, use `analysisKey` as the non-null canonical identity rather than relying on nullable columns alone.

## 4.3 CostCommentaryHistory

Append-only revision history for commentary.

Required fields:

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

Unique:

```text
(commentaryId, version)
```

Append a history row for every material workflow/content transition, including initial Draft, Submit, Return, re-Draft/resubmit, and Review.

Never overwrite history.

## 4.4 CostPeriodReview

Period-level analytical review evidence.

Required concepts:

```text
id
periodId
reviewStatus
reviewedById nullable
reviewedAt nullable
note nullable
createdAt
updatedAt
```

Use a clear finite lifecycle such as:

```text
OPEN
IN_REVIEW
COMPLETED
```

or an equivalent explicit enum consistent with existing conventions.

One current review record per Cost Period is sufficient unless implementation evidence proves a need for more.

Do not overload `CostPeriod.status`; Engine 1 FINALIZED status and Phase I analytical review are separate states.

---

# 5. PRODUCTION MIGRATION DISCIPLINE

Phase I requires an additive schema migration.

Follow `DATABASE_RUNTIME.md` exactly.

Expected workflow in this PR:

1. update `prisma/schema.prisma`;
2. create/review a new additive repository migration SQL;
3. run Prisma format/validate/generate;
4. run TypeScript/tests/build;
5. ensure migration contains no destructive legacy operations;
6. open PR;
7. **do not apply production DDL from Codex**.

Production Supabase migration will be applied only after external PR/schema review.

Do not run against production:

```text
prisma migrate deploy
prisma migrate reset
prisma db push
```

Do not fabricate old `_prisma_migrations` history.

Migration SQL should only add the Phase I models/enums/indexes/FKs/check constraints needed for this scope.

---

# 6. MATERIALITY RULE RESOLUTION

Materiality rules are effective-dated and comparison-specific.

Rule resolution input:

```text
Company
Cost Group
Comparison Type
Current Cost Period
```

Use the current reporting period's `periodEnd` as the effective-date point for materiality rule selection unless an existing repository convention already provides a stronger period-effective-date helper. If a different existing convention is reused, document it and keep tests deterministic.

Resolution priority:

1. exact Company + Cost Group + Comparison Type rule;
2. Company-wide (`costGroupId = null`) + Comparison Type fallback.

Do not fallback across companies.

Do not fallback across comparison types.

If multiple active/effective rules match at the same specificity, throw a materiality integrity/configuration error.

If no rule applies, return an explicit `NOT_CONFIGURED` state.

Do not assume NORMAL.

---

# 7. MATERIALITY CALCULATION SEMANTICS

Materiality must be deterministic and use exact Decimal math.

Materiality operates on Phase H output only.

For a non-Company analytical node:

```text
amountMagnitude = ABS(varianceAmount)
percentMagnitude = ABS(variancePercent)
```

The Phase H `variancePercent` value is expressed in percentage points, e.g.:

```text
20.000000 = 20%
```

Therefore a configured percent threshold of:

```text
20.000000
```

means 20%.

Threshold condition uses inclusive comparison:

```text
magnitude >= threshold
```

Materiality must never change variance sign or accounting amounts.

## 7.1 Statuses

Support explicit status semantics at minimum equivalent to:

```text
REQUIRES_EXPLANATION
NORMAL
NOT_CONFIGURED
NOT_EVALUABLE
UNAVAILABLE
NOT_APPLICABLE
```

Company root is `NOT_APPLICABLE` unless a later business requirement explicitly makes Company-level commentary a target.

If Phase H comparison status is UNAVAILABLE, materiality is UNAVAILABLE.

If no rule applies, materiality is NOT_CONFIGURED.

## 7.2 AND / OR and N/M percentage

Percentage may be non-evaluable when Phase H variance percentage status is `NM`.

Use three-state logical behavior rather than silently treating N/M as zero.

For each configured criterion classify:

```text
PASS
FAIL
NOT_EVALUABLE
```

Amount criterion is normally evaluable.

Percent criterion is NOT_EVALUABLE when Phase H variance percentage is not available/NM.

For `OR`:

- any configured PASS => REQUIRES_EXPLANATION;
- otherwise, if any configured criterion is NOT_EVALUABLE => NOT_EVALUABLE;
- otherwise => NORMAL.

For `AND`:

- any configured FAIL => NORMAL;
- else if any configured criterion is NOT_EVALUABLE => NOT_EVALUABLE;
- else all configured criteria PASS => REQUIRES_EXPLANATION.

If only one threshold is configured, evaluate only that threshold; the operator does not manufacture a missing second criterion.

This behavior must be covered by tests, especially zero-comparison/NM scenarios.

---

# 8. MATERIALITY OUTPUT

Do not persist a materiality result table in Phase I unless a proven requirement is discovered.

Materiality is derivable from:

```text
immutable Phase H output
+
effective-dated CostMaterialityRule
```

Return a read-only materiality overlay/tree keyed by stable Phase H analytical key.

Recommended API:

```text
GET /api/cost-fluctuation/materiality?periodId=<id>&comparison=MOM|YOY|YTD
```

Response should include:

```text
comparisonType
comparisonStatus
materialityStatus per node
ruleId when applicable
rule scope
thresholds/operator
criterion evaluation
analysisKey
```

Do not expose private workbook/source data.

Do not recalculate Engine 2 independently; call/reuse the existing Phase H service.

---

# 9. MATERIALITY RULE ADMIN API

Implement server-side admin endpoints under the new module namespace, for example:

```text
GET  /api/cost-fluctuation/materiality-rules
POST /api/cost-fluctuation/materiality-rules
```

and a version/change endpoint if needed.

ADMIN_SYSTEM only for mutations.

Read access for rules may be ADMIN only unless UI needs readers to see rule metadata.

Prefer effective-dated versioning over destructive historical edits.

Once a rule has already become effective for historical accounting periods, do not silently rewrite its thresholds in place. A change should close/end-date the previous rule and create a successor effective version where practical.

Every materiality configuration change must create `CostAuditLog` action:

```text
CHANGE_MATERIALITY
```

with useful before/after context.

---

# 10. COMMENTARY WORKFLOW — LOCKED

Commentary is separate for:

```text
MOM
YOY
YTD
```

The same Nature/COA may therefore have different commentary for each comparison type.

Commentary never alters calculated amounts.

## 10.1 OPEN is derived

Do not eagerly create thousands of empty commentary rows.

Treat `OPEN` as a derived workflow state when:

```text
materialityStatus = REQUIRES_EXPLANATION
and
no current-lineage commentary exists
```

Persist a `CostCommentary` row when the preparer first saves a Draft.

Persisted statuses:

```text
DRAFT
SUBMITTED
RETURNED
REVIEWED
```

The UI/API may expose derived `OPEN` when no row exists.

## 10.2 Save Draft

Allowed:

```text
no row → DRAFT
DRAFT → DRAFT
RETURNED → DRAFT
```

Role:

```text
ADMIN_SYSTEM
STAFF_ACCOUNTING
```

Server derives:

- user identity;
- stable analysis target;
- current analysisLineageKey.

Do not accept client-supplied preparer identity.

Draft may be incomplete, but sanitize/validate text length and type.

## 10.3 Submit

Allowed:

```text
DRAFT → SUBMITTED
```

Submission requires non-blank commentary reason.

Set submitted timestamp.

Append history.

Audit:

```text
SUBMIT_COMMENTARY
```

## 10.4 Return

Allowed:

```text
SUBMITTED → RETURNED
```

Role:

```text
ADMIN_SYSTEM
SUPERVISOR_ACCOUNTING
```

Reviewer note is mandatory when returning.

Append history.

Audit:

```text
RETURN_COMMENTARY
```

## 10.5 Resubmit

Returned commentary must go through:

```text
RETURNED → DRAFT → SUBMITTED
```

Do not silently jump RETURNED directly to REVIEWED.

History must preserve each revision.

## 10.6 Review/approve

Allowed:

```text
SUBMITTED → REVIEWED
```

Role:

```text
ADMIN_SYSTEM
SUPERVISOR_ACCOUNTING
```

Enforce maker/checker:

```text
reviewer user ID != preparer user ID
```

For Phase I, do not implement a self-review override even for ADMIN_SYSTEM. A future explicit override can be added only with separately approved business rules.

Set reviewedBy/reviewedAt.

Append history.

Audit:

```text
REVIEW_COMMENTARY
```

## 10.7 Reviewed immutability

A REVIEWED commentary is immutable through normal commentary APIs.

Do not let a preparer edit a reviewed reason in place.

If underlying Engine 1 finalized lineage later changes after a controlled reopen/re-finalization, the old commentary remains historical because its `analysisLineageKey` differs from the new current analysis lineage.

Current analysis views must not silently present an old-lineage reviewed commentary as current.

---

# 11. COMMENTARY TARGET VALIDATION

On every commentary create/save/submit action:

1. load the requested Phase H comparison using the existing service;
2. require Phase H status AVAILABLE;
3. locate the target analytical node by stable server-known identity;
4. verify Cost Group/Nature/COA/calculated item relations match the hierarchy;
5. derive canonical `analysisKey`;
6. derive current `analysisLineageKey`;
7. reject stale/mismatched targets.

Do not allow commentary against:

- missing comparison history;
- non-finalized current periods;
- arbitrary client-defined COA IDs;
- fake calculated-item COAs;
- Derivatif.

Allow commentary on normal/non-material nodes as optional explanation if authorized, but only `REQUIRES_EXPLANATION` nodes participate in mandatory explanation completeness.

---

# 12. COMMENTARY API

Use the recommended namespace:

```text
/api/cost-fluctuation/commentary
```

Suggested routes/actions:

```text
GET  /api/cost-fluctuation/commentary?periodId=<id>&comparison=MOM|YOY|YTD
POST /api/cost-fluctuation/commentary/draft
POST /api/cost-fluctuation/commentary/[id]/submit
POST /api/cost-fluctuation/commentary/[id]/return
POST /api/cost-fluctuation/commentary/[id]/review
```

Exact route split may vary if consistent with repository patterns.

GET response should distinguish:

```text
OPEN derived material item
DRAFT
SUBMITTED
RETURNED
REVIEWED
```

and include enough context for UI:

```text
analysisKey
node label/type
materiality status
reason
status
preparer metadata
reviewer metadata/reviewer note
history/version count where useful
```

Do not return source workbook rows.

---

# 13. COMMENTARY HISTORY & TRANSACTIONS

Commentary state mutation + history append + audit log must commit atomically.

Use Prisma transaction patterns consistent with the repository.

For each mutation:

```text
validate current state
validate authorization
validate lineage
write commentary
append CostCommentaryHistory
append CostAuditLog
```

If any step fails, none of the mutation should be committed.

History version numbers must be monotonic per commentary.

Protect against duplicate concurrent transitions.

---

# 14. PERIOD REVIEW

Phase I includes period-level analytical review evidence.

Recommended API:

```text
GET  /api/cost-fluctuation/review?periodId=<id>
POST /api/cost-fluctuation/review/complete
```

or equivalent period-scoped routes.

Only FINALIZED Cost Periods can enter analytical review.

A period review may become COMPLETED only when:

1. at least one of MOM / YOY / YTD is AVAILABLE;
2. all applicable materiality rules required for available analyses resolve deterministically;
3. no mandatory materiality result is `NOT_CONFIGURED` or `NOT_EVALUABLE`;
4. every current-lineage node with `REQUIRES_EXPLANATION` has a current-lineage `REVIEWED` commentary;
5. any current-lineage SUBMITTED mandatory commentary is fully reviewed;
6. reviewer authorization passes.

Unavailable comparison types are not zero and are not treated as missing commentary failures.

If all three comparisons are unavailable, period analytical review is not ready/completable; return a clear state rather than auto-completing an empty review.

Completion action creates/updates `CostPeriodReview` and an audit entry such as:

```text
COMPLETE_FLUCTUATION_REVIEW
```

Do not modify `CostPeriod.status`.

---

# 15. UI SCOPE — PHASE I ONLY

Phase I must provide a functional but not fully polished workflow UI.

Do **not** implement the full Phase J dashboard/chart/export suite.

Enhance `/cost-fluctuation` enough to support:

- select Company/Period/Comparison;
- show Phase H analytical rows;
- show Materiality status;
- show Commentary status;
- open commentary context/editor;
- Save Draft;
- Submit;
- Return with note;
- Review;
- show period review readiness/status.

Preserve existing SIG ACTIVA visual language.

Do not build advanced charts/waterfall/trend/export here; those are Phase J.

## 15.1 Materiality admin UI

Add a small ADMIN_SYSTEM-only configuration screen using an appropriate route under the Cost Structure/Fluctuation administrative namespace.

It should support at minimum:

- list rules;
- Company;
- optional Cost Group;
- Comparison Type;
- amount threshold;
- percent threshold;
- AND/OR;
- valid-from / valid-to;
- create successor/change rule without rewriting historical accounting amounts.

No threshold should be prefilled as a business default unless it is purely empty UI state.

---

# 16. AUDIT ACTIONS

Reuse `CostAuditLog`.

Required Phase I actions at minimum:

```text
CHANGE_MATERIALITY
SAVE_COMMENTARY
SUBMIT_COMMENTARY
RETURN_COMMENTARY
REVIEW_COMMENTARY
COMPLETE_FLUCTUATION_REVIEW
```

Use clear entityType/entityId and periodId.

Audit log is append-only through normal workflow.

Do not store secrets or excessive source data in audit JSON.

---

# 17. PHASE I TESTS — MANDATORY

Implement deterministic tests that do not require production Supabase.

Use repository/service abstraction or dependency injection where useful, similar to Phase H.

## Materiality documented tests

### MAT-001 Below threshold

Expected:

```text
NORMAL
```

### MAT-002 Meets threshold

Expected:

```text
REQUIRES_EXPLANATION
```

### MAT-003 Effective-date change

Old period uses old effective rule; new period uses successor rule.

## Additional materiality tests

- no matching rule => NOT_CONFIGURED;
- Cost Group-specific rule overrides Company fallback;
- no cross-company fallback;
- no cross-comparison fallback;
- ambiguous same-specificity rules fail loudly;
- amount threshold uses ABS variance amount;
- percent threshold uses ABS percentage points;
- threshold equality is material (`>=`);
- OR semantics;
- AND semantics;
- only-one-threshold configured;
- percent NM tri-state semantics;
- Phase H UNAVAILABLE => materiality UNAVAILABLE;
- Company root => NOT_APPLICABLE;
- calculated item inherits rule from its Cost Group scope;
- no hard-coded threshold values.

## Commentary documented tests

### COM-001 Separate comparison reasons

MOM, YOY and YTD can store different reasons for the same analytical object.

### COM-002 Draft → Submitted

Valid preparer transition.

### COM-003 Submitted → Returned

Reviewer note required.

### COM-004 Returned → Draft → Submitted

History retained and version increases.

### COM-005 Review authorization

Preparer cannot self-review through API/domain service.

## Additional commentary tests

- unauthenticated mutation rejected;
- read-only role cannot prepare;
- prepare role cannot review;
- review role can return/review;
- reviewed commentary immutable;
- submit requires nonblank reason;
- state-machine invalid transition rejected;
- every transition writes history;
- every material action writes audit;
- same target can hold distinct MOM/YOY/YTD records;
- calculated-item commentary works with no fake COA;
- arbitrary/nonexistent analysisKey rejected;
- Derivatif cannot become a target;
- Phase H UNAVAILABLE cannot accept commentary;
- stale analysisLineageKey cannot be submitted/reviewed as current;
- current analysis does not reuse old-lineage reviewed commentary after lineage change;
- repeated GET is deterministic;
- commentary mutation never writes/changes Engine 1 or Engine 2 amounts.

## Period review tests

- non-FINALIZED period cannot be reviewed;
- all comparisons unavailable => not completable;
- materiality NOT_CONFIGURED blocks completion;
- materiality NOT_EVALUABLE blocks completion;
- required commentary OPEN/DRAFT/SUBMITTED/RETURNED blocks completion;
- all required material commentary REVIEWED allows completion;
- NORMAL rows do not require commentary;
- unavailable comparison type does not create false missing-commentary blocker;
- unauthorized completion rejected;
- completion creates audit trail;
- `CostPeriod.status` remains FINALIZED after analytical review.

## Migration tests/review

Verify generated SQL:

- adds only Phase I enums/tables/indexes/FKs/checks;
- does not drop/rename legacy tables;
- does not modify existing accounting amounts;
- uses numeric/Decimal for thresholds;
- has intended uniqueness/indexes.

---

# 18. SECURITY TESTS

At minimum cover relevant project cases:

```text
AUTH-001 unauthenticated => 401
AUTH-002 read role can read but cannot write
AUTH-003 STAFF_ACCOUNTING can prepare but cannot admin/review
AUTH-004 SUPERVISOR_ACCOUNTING can review but not materiality-admin unless existing policy says otherwise
AUTH-005 ADMIN_SYSTEM can manage materiality
AUTH-006 new helpers/routes do not weaken existing module APIs
```

Maker/checker must use actual session user IDs, not role only.

---

# 19. DO NOT IMPLEMENT PHASE J

Out of scope for Phase I:

- final fluctuation KPI dashboard;
- top-increase/decrease chart suite;
- waterfall;
- long-term trend visualization;
- final Engine 2 Excel export;
- export presentation redesign;
- Phase G workbook visual polish;
- AI-generated accounting reasons;
- SAP integration;
- budget/forecast.

Phase I UI is workflow-focused only.

---

# 20. NO AI AUTO-COMMENTARY IN PHASE I

Do not introduce generative AI commentary in this phase.

Commentary is user-prepared and reviewer-controlled.

If AI assistance is ever added later, it must remain a draft requiring user validation and cannot become an accounting source.

---

# 21. DOCUMENTATION

Create:

`docs/cost-structure-fluctuation/PHASE_I_MATERIALITY_COMMENTARY_REVIEW.md`

Document:

- schema;
- materiality rule resolution;
- threshold units;
- AND/OR semantics;
- NM tri-state behavior;
- no-rule behavior;
- effective dating;
- commentary analytical identity;
- lineage binding;
- state machine;
- maker/checker;
- history/audit transaction behavior;
- period review readiness/completion;
- authorization;
- APIs;
- UI scope;
- migration process;
- test coverage;
- Phase J deferred scope.

Update `PROJECT_STATUS.md` only after implementation/tests are actually complete, and use a conservative state such as:

```text
Phase I — IMPLEMENTED / REVIEW
```

Do not mark Phase I production complete before schema migration and deployment are externally reviewed/applied.

---

# 22. REQUIRED VALIDATION BEFORE PR

Run repository-required checks plus:

```bash
npx prisma format
npx prisma validate
npx prisma generate
npx tsc --noEmit
```

Run all Phase I tests directly if necessary.

Ensure the repository test runner includes new Phase I test files.

Run targeted ESLint on all changed Phase I files.

Run:

```bash
git diff --check
```

Run:

```bash
npm test
```

If the same known Engine 1 baseline failures still exist, verify they also exist on the current `main` baseline and document them precisely. Do not change unrelated Engine 1 behavior merely to make pre-existing tests green.

Run:

```bash
npm run build
```

If local build cannot finish because `DATABASE_URL` is absent, TypeScript/build compilation must still be checked and Vercel Preview must be the full environment gate after the PR is pushed.

Inspect the migration SQL manually before PR ready.

---

# 23. EXPECTED FILE AREAS

Likely changes include:

```text
prisma/schema.prisma
prisma/migrations/<phase-i-migration>/migration.sql

lib/cost-fluctuation/materiality/**
lib/cost-fluctuation/commentary/**
lib/cost-fluctuation/review/**

app/api/cost-fluctuation/materiality/**
app/api/cost-fluctuation/materiality-rules/**
app/api/cost-fluctuation/commentary/**
app/api/cost-fluctuation/review/**

app/cost-fluctuation/**

lib/cost-fluctuation/**/*.test.ts

docs/cost-structure-fluctuation/PHASE_I_MATERIALITY_COMMENTARY_REVIEW.md
docs/cost-structure-fluctuation/PROJECT_STATUS.md
```

Exact structure may vary if the repository already has better conventions.

Keep business logic outside large React components and thin API routes.

---

# 24. PR REQUIREMENTS

Open one PR from:

`feat/phase-i-materiality-commentary-review`

to:

`main`

Suggested title:

`feat(cost-fluctuation): implement Phase I materiality commentary and review`

PR body must include:

## Summary

What was implemented.

## Materiality

Rule hierarchy, effective dating, threshold semantics, NM behavior, and no-default-threshold policy.

## Commentary

State machine, analytical identity, lineage binding, maker/checker, history.

## Review

Period-level completion rules.

## Database

List new models/enums and the additive migration file.

Explicitly state:

`Production migration has NOT been applied by Codex.`

## Security

Roles and negative tests.

## Tests

Commands/results and known baseline failures if any.

## Vercel

Preview deployment status for PR head.

## Scope boundaries

Confirm Phase J dashboard/export and AI commentary were not implemented.

Do not merge the PR.

---

# 25. DEFINITION OF DONE FOR PHASE I IMPLEMENTATION REVIEW

Phase I implementation is ready for external review only when:

- all four Phase I persisted models exist;
- migration is additive and reviewed locally;
- no production DDL was applied by Codex;
- no hard-coded materiality threshold exists;
- effective rule resolution is deterministic;
- group-specific rule override works;
- no-rule state is explicit;
- amount/percent Decimal semantics are correct;
- NM materiality tri-state semantics are correct;
- materiality never changes analytical amounts;
- OPEN is derived without mass empty commentary rows;
- MOM/YOY/YTD commentary is separate;
- calculated-item commentary works without fake COA;
- commentary binds to exact Engine 2 lineage;
- stale lineage is not silently reused;
- Draft/Submit/Return/Review transitions are enforced;
- returned note is required;
- submit requires reason;
- maker/checker prevents self-review;
- REVIEWED is immutable in normal flow;
- history is append-only and versioned;
- workflow mutations are transactional with audit log;
- period review does not alter CostPeriod FINALIZED status;
- period review cannot complete with missing required explanations;
- unavailable comparison periods are not treated as zero;
- authorization is enforced server-side;
- Phase I tests pass;
- TypeScript passes;
- targeted lint passes;
- migration contains no destructive legacy operations;
- Vercel preview is READY;
- documentation is complete;
- PR is open and unmerged.

Proceed with Phase I implementation now after completing the mandatory preflight.
