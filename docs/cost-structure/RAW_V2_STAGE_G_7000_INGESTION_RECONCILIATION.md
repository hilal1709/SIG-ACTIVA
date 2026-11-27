# Raw SAP Engine 1 V2 — Stage G Company 7000 Ingestion & Reconciliation

## 1. Purpose and boundary

Stage G extends the isolated Raw SAP Engine 1 V2 to Company 7000 without changing the validated Company 2000 pipeline.

Stage G is a **raw ingestion, source certification, normalization, and source-control phase**. It does not calculate HPP, ADUM, PASAR, OA, Selisih Persediaan, GHoPO, or DERIV analysis basis.

The intended Raw V2 rule-set identity for future Company 7000 calculation remains:

```text
ENGINE1_7000_RAW_V3
```

Stage G must not reuse or write legacy `ENGINE1_7000_V2` calculation transactions.

Stage G must not change Company 2000 `ENGINE1_2000_RAW_V3`, Stage E results, Stage F reporting/export, or any legacy Cost Structure workflow.

## 2. Accounting rules already locked for later Stage H

These are acceptance context only. Stage G must preserve the inputs needed to implement them later and must not calculate them yet.

```text
Total HPP
= TB account-group-5 total
- COGS Mortar COA 51300003

Selisih Persediaan
= Total HPP
- sum of HPP natures before Selisih Persediaan

Total PASAR
= PASAR regular + OA

Total GHoPO
= HPP + ADUM + PASAR
```

Company 7000 DERIV is excluded from Engine 1 GHoPO. Future Engine 2 may use GHoPO + DERIV as separate analysis bases. DERIV is never a fourth Cost Group.

Stage G must not silently include DERIV in Engine 1 source reconciliation or GHoPO readiness.

## 3. Golden reference, not runtime constants

July 2026 remains the Company 7000 golden accounting reference for later Stage H parity:

```text
HPP           413,169,722,810
ADUM           11,667,383,975
PASAR regular   9,572,860,045
OA             72,068,727,025
PASAR total    81,641,587,070
TOTAL GHoPO   506,478,693,855
```

These amounts must never be hard-coded into runtime calculation or parser logic.

## 4. Stage G source tiers

Stage G distinguishes sources whose raw contract is already locked from sources whose exact identity/adapter still requires certification.

### 4.1 Tier A — certified core sources

The following are required for a Company 7000 Stage G core-valid upload:

| Logical source | Requirement | Contract |
|---|---|---|
| `TB` | REQUIRED | shared Raw V2 semantic TB contract |
| `CC_ADUM` | REQUIRED | shared B:K CC contract, Cost Center Group `SGK_ADM` |
| `CC_PASAR` | REQUIRED | shared B:K CC contract, Cost Center Group `SGK_PASAR` |

A missing, malformed, period-mismatched, or unreconciled Tier A source is an ERROR and the upload must not become the active valid version.

### 4.2 Tier B — Company 7000 calculation-support candidates

Known Company 7000 source families used by the validated existing engine include:

```text
CC_PROD
CC_WHRPG
COAL
CLINKER_PURCHASE
SOLAR_PP_ORDER
OA_STAT
```

Stage G must preserve detected candidate evidence for these sources, but must not invent an authoritative contract that has not been certified from raw source evidence.

Rules:

1. `CC_PROD` and `CC_WHRPG` are Cost Center reports and ultimately must obey the same authoritative Excel B:K CC rules, including semantic metadata, `Cost Elements` / `Act. Costs`, and exact detail-to-Debit reconciliation.
2. The exact Company 7000 Cost Center Group identifiers for `CC_PROD` and `CC_WHRPG` are not currently locked. Do not guess them from labels, prefixes, neighboring companies, or workbook formulas.
3. An exact sheet-name hint may be used only to identify a **candidate for inspection**. It must not silently turn an unknown Cost Center Group into a certified logical financial source.
4. If the candidate has an unknown Cost Center Group, preserve its metadata and rows and surface a stable certification issue. Do not discard the evidence and do not use it in later calculation readiness.
5. `COAL`, `CLINKER_PURCHASE`, `SOLAR_PP_ORDER`, and `OA_STAT` are known support families with validated legacy business adapters. Stage G may preserve their raw worksheet evidence under explicit support-candidate adapters, but Stage G must not use cached helper/output formulas as authoritative final amounts.
6. Each Tier B source must carry source-level metadata identifying whether its Stage G contract is `CERTIFIED` or `CERTIFICATION_PENDING`.
7. Stage H must fail closed unless every support source required by its formula dependency graph is certified and present/valid under the Stage H contract.

Tier B pending certification is not permission to treat a source as zero.

## 5. DERIV and audit/reference sheets

Company 7000 derivative/reference material must remain separated from Engine 1 GHoPO.

Rules:

- `DERIV`, `CC_DRV`, `SI2000_DRV`, `AUDIT_GHOPO`, `AUDIT_DERIV`, `AUDIT_RINCIAN`, and similar existing workbook output/audit sheets are not authoritative monthly Engine 1 raw inputs for Stage G.
- They may be retained as diagnostic/golden evidence if already supported by a separate audit snapshot mechanism, but they must not satisfy a mandatory Raw V2 Stage G financial source requirement.
- Do not require `rincian biaya` or `GHoPO` for a new Raw V2 Company 7000 upload.
- Do not calculate or export a Company 7000 DERIV basis in Stage G.

## 6. TB contract — Company 7000

Company 7000 uses the exact shared Raw V2 TB contract already locked in Stage A.

Authoritative fields are semantic:

```text
FS Item/Account
FY <year> 1-<period>
FY <year> 1-<period-1>   [periods 2-12]
Variance
```

For every financial COA row:

```text
monthlyAmount = Variance
currentYtd - previousYtd - Variance = 0
```

COA extraction remains the terminal 8-digit account after `/`.

No helper columns, workbook formulas, or net TB total may substitute for row-level variance validation.

January remains subject to the already locked January TB semantic rule and requires real-fixture certification before January Raw V2 production certification.

## 7. Core Cost Center contract — ADUM and PASAR

Only absolute Excel columns B:K are authoritative for Company 7000 Cost Center reports.

Certified group registry for Stage G:

```text
SGK_ADM   -> CC_ADUM
SGK_PASAR -> CC_PASAR
```

Required metadata:

```text
Controlling Area
Fiscal Year
From Period
To Period
Cost Center Group
```

Required financial semantic header:

```text
Cost Elements
Act. Costs
```

Detail COA pattern:

```text
^\s*(\d{8})(?:\s+|$)
```

Mandatory control:

```text
SUM(detail Act. Costs) - Debit = 0
```

The first Debit ends the authoritative detail population. A Credit section after Debit is not ordinary detail for the same source.

`Over/Underabsorption`, if present, is retained as secondary evidence.

Sheet aliases are secondary hints only. If sheet hint conflicts with the certified Cost Center Group, raise `RAW_SOURCE_CLASSIFICATION_CONFLICT`.

## 8. Support-source preservation contract

For a Tier B support candidate, Stage G must preserve enough immutable evidence to certify and implement Stage H without returning to opaque workbook helper logic.

At minimum retain:

```text
logical/candidate source family
original sheet name
source row number
raw row/cell snapshot
file hash / upload identity
source-level detection metadata
certification status
validation issues
```

For Cost Center candidates, also retain parsed metadata and B:K source-control evidence when safely available.

For non-CC support candidates, raw preservation may precede semantic financial normalization. `amount = null` is valid for evidence rows that have not yet been certified into a financial semantic field; it must not be interpreted as zero.

No Stage G support parser may use `IFERROR(...,0)` behavior.

## 9. Cross-source period controls

All certified present Tier A sources must agree exactly with the selected upload context:

```text
companyCode = 7000
fiscalYear
fiscalPeriod
```

TB-derived period and CC metadata period must match.

Any mismatch is `RAW_CROSS_SOURCE_PERIOD_MISMATCH` ERROR.

For Tier B sources that expose explicit fiscal metadata, mismatching metadata is also ERROR. If a support source does not expose a certified period field yet, record that fact in certification metadata rather than inventing a period from filename.

## 10. Company-specific source requirements

Raw V2 source requirement logic must become company-specific.

### Company 2000 — preserve current behavior exactly

```text
REQUIRED:      TB, CC_ADUM, CC_PASAR
OPTIONAL-ZERO: CC_PROD, CC_DERIV
```

Do not regress the validated August 2026 Company 2000 path.

### Company 7000 — Stage G core

```text
REQUIRED CORE: TB, CC_ADUM, CC_PASAR
SUPPORT CANDIDATES: CC_PROD, CC_WHRPG, COAL,
                    CLINKER_PURCHASE, SOLAR_PP_ORDER, OA_STAT
DERIV/AUDIT: non-Engine-1 evidence only
```

Do not fabricate `ABSENT_TREATED_AS_ZERO` for missing Company 7000 `CC_PROD`, `CC_WHRPG`, COAL, clinker, solar, or OA support merely because their contract is pending. Missing support must remain explicit and will block Stage H readiness when required.

## 11. Stage G reconciliation outputs

Stage G source reconciliation is source-level validation only.

For Tier A:

- TB row-level variance checks must all pass;
- CC_ADUM detail-to-Debit = 0;
- CC_PASAR detail-to-Debit = 0;
- cross-source period control must pass;
- no duplicate required source;
- no ambiguous source classification.

For certified Tier B CC sources, the same detail-to-Debit control is required.

Stage G must not invent a Company 7000 equation such as:

```text
TB = CC_ADUM + CC_PASAR + CC_PROD + ...
```

unless a separately verified business control explicitly defines that equality. Stage G is not allowed to force unrelated TB populations to reconcile by arbitrary addition.

## 12. Upload lifecycle and activation

Reuse the isolated Raw V2 period/upload/source/source-row/validation tables.

Preferred implementation requires no new migration.

A Company 7000 upload may become active `VALIDATED` when all Stage G **core** ERROR conditions are clear. Tier B certification-pending warnings remain visible and must prevent Stage H calculation readiness, not core raw evidence preservation.

A new INVALID diagnostic upload must not supersede the previous active valid upload.

A valid new upload supersedes the prior active Raw V2 upload atomically, retaining all history.

Do not change any legacy `cost_periods`, `cost_uploads`, `cost_source_rows`, calculation run, result, or finalization pointers.

## 13. UI / operational behavior

The Raw V2 upload workspace must support selecting:

```text
2000
7000
```

For Company 2000, current Stage F workflow stays unchanged.

For Company 7000, Stage G UI must clearly state:

```text
Raw source ingestion / certification only
HPP / GHoPO calculation not enabled yet
```

Show at minimum:

- selected company/year/period;
- upload version/status;
- core source presence and controls;
- TB row coverage;
- CC group/rows/non-zero/total/Debit/difference;
- support-source candidate inventory;
- certification status for support candidates;
- ERROR/WARNING/INFO issues separated visibly;
- explicit `Stage H blocked` reasons when required support certification is incomplete.

Do not show a Company 7000 Calculate GHoPO button in Stage G.

## 14. APIs and security

Existing isolated endpoints may be extended:

```text
POST /api/cost-structure/raw-v2/uploads/init
POST /api/cost-structure/raw-v2/uploads/complete
GET  /api/cost-structure/raw-v2/uploads?companyCode=7000
```

Requirements:

- PREPARE permission for upload/init/complete;
- READ permission for reads;
- signed pending upload context must bind company/year/period/file/user;
- storage key must use the selected Company 7000 namespace;
- never accept arbitrary company code outside supported `2000|7000`;
- all responses with financial/read data retain existing private/no-cache security where applicable.

## 15. Stable issue codes

Retain Stage A issue codes and add narrowly scoped Stage G codes where needed, for example:

```text
RAW_SUPPORT_CONTRACT_PENDING
RAW_SUPPORT_REQUIRED_MISSING
RAW_CC_GROUP_CERTIFICATION_REQUIRED
RAW_SUPPORT_PERIOD_UNVERIFIED
```

Use WARNING/INFO for preserved-but-not-yet-certified Stage G support evidence when core ingestion may remain valid.

Use ERROR for malformed certified mandatory sources, period mismatch, ambiguous required source, invalid amount, missing Debit, or detail-to-Debit mismatch.

A warning must never later be interpreted as a certified calculation input without an explicit contract upgrade.

## 16. Calculation and export gates

During Stage G:

```text
Company 2000 calculation: unchanged/enabled
Company 2000 export:      unchanged/enabled
Company 7000 upload:      enabled
Company 7000 core validation/reconciliation: enabled
Company 7000 HPP/GHoPO calculation: disabled
Company 7000 export:      disabled
```

Do not change the global `RAW_V2_CAPABILITIES` in a way that accidentally implies Company 7000 calculation/export availability. If necessary, introduce a company-aware capability/readiness helper while keeping Company 2000 behavior unchanged.

## 17. Production evidence to preserve in tests/docs

Validated existing Company 7000 July 2026 legacy evidence confirms the source families and general shapes used by the existing engine, including:

```text
TB
CC_ADUM
CC_PASAR
CC_PROD
CC_WHRPG
COAL
CLINKER_PURCHASE
SOLAR_PP_ORDER
OA_STAT
```

This evidence is sufficient to build candidate preservation and certification workflow, but it is not permission to guess unobserved Cost Center Group identifiers.

Golden/raw workbooks must remain private. Commit synthetic fixtures only.

## 18. Stage G acceptance gates

Stage G code acceptance requires:

1. Company 2000 Stage C-F regression tests remain green.
2. Upload init accepts only `2000` or `7000` and signs the actual selected company.
3. Company 7000 TB uses the shared semantic TB parser.
4. `SGK_ADM` resolves exactly to `CC_ADUM`.
5. `SGK_PASAR` resolves exactly to `CC_PASAR`.
6. ADUM/PASAR B:K detail-to-Debit controls fail closed.
7. First Debit ends the authoritative CC detail section.
8. An unknown Company 7000 CC group is never silently classified from a sheet hint.
9. Unknown `CC_PROD`/`CC_WHRPG` candidates are preserved with certification evidence rather than discarded or treated as zero.
10. Known support families can be inventoried/preserved without making helper/output formulas authoritative.
11. Missing/pending support is visible and blocks Stage H readiness but does not masquerade as zero.
12. No Company 7000 calculation or export endpoint is enabled.
13. No legacy transaction model is written.
14. No production migration is included unless an unavoidable requirement is first documented and explicitly approved separately.
15. Synthetic tests cover source ambiguity, wrong period, unknown group, missing Debit, Debit mismatch, support pending, and Company 2000 non-regression.

## 19. Stage G production acceptance plan

After code merge/deploy, production acceptance is interactive and non-destructive:

1. select Company 7000 and July 2026;
2. upload the private golden/raw Company 7000 workbook through Raw V2;
3. verify TB + `SGK_ADM` + `SGK_PASAR` core controls;
4. inspect persisted metadata for `CC_PROD`, `CC_WHRPG`, and support sheets;
5. certify exact missing source contracts from the real fixture in a subsequent reviewed change;
6. re-upload/revalidate if a source-contract registry changes;
7. only after all Stage H dependencies are certified may Stage H calculation work begin.

Do not copy legacy finalized accounting rows into Raw V2 as a substitute for this acceptance.

## 20. Hard exclusions

Stage G must not:

- change Company 2000 formulas or persisted results;
- implement HPP/GHoPO calculation;
- implement OA formula;
- implement coal formula output;
- implement Selisih Persediaan;
- implement Company 7000 mapping/results;
- implement Engine 2 DERIV basis;
- require GHoPO/Rincian/audit output sheets as raw monthly authority;
- guess unknown Cost Center Group identifiers;
- auto-finalize/reopen a period;
- modify legacy Cost Structure data;
- add destructive migration;
- commit private financial workbooks.
