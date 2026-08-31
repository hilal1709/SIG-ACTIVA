# Golden Dataset — Engine 1

## Company 2000 — July 2026 superseding SI golden

The former CC-only result remains historical evidence but is superseded for V2 runs. Raw IDR:
ADUM `107844157911`, PASAR `16487761095`, total `124331919006`. Rincian `125820825551` less
reconciled CC derivative `1488906545` equals final SI.

## Company 7000 — July 2026 Phase F arithmetic fixture

The code-level golden fixture asserts HPP `413,169,722,810.00`, ADUM `11,667,383,975.00`, PASAR regular `9,572,860,045.00`, OA `72,068,727,025.00`, total PASAR `81,641,587,070.00`, and total company `506,478,693,855.00`. Batubara normalizes to `93,152,232,023.32`, Batubara Inbound to `41,023,853,211.68`, and Selisih Persediaan to `-21,153,010,152.00`; HPP reconciliation is exactly zero.

This fixture proves deterministic Decimal arithmetic. It is not a substitute for the private-workbook application E2E gate. The real Company 7000 workbook adapter for account-group-5/COGS Mortar, COAL components and OA_STAT remains intentionally fail-closed until verified against the private workbook.

## Company 2000 contract

Reference period: **July 2026**.

Private source references:

- `Fluktuasi Biaya 2000 - 07.2026.xlsx`
- `TB 2000 07-2026 (Exc Derivatif)(1).xlsx`

Authoritative expected values in full IDR:

| Result | Amount |
| --- | ---: |
| PASAR | 17,900,551,142 |
| ADUM | 107,796,550,061 |
| TOTAL | 125,697,101,203 |
| Derivatif effect | 0 |

The invariant is `ADUM + PASAR = TOTAL`. These values must not be changed to accommodate system output.

## Golden source structure verified

The private July-2026 workbooks were inspected without committing their contents. The following structural contracts are verified and test-locked:

- workbook sheet `tb` maps to logical source `TB`;
- workbook sheet `cc_adm` maps to logical source `CC_ADUM`;
- workbook sheet `cc pasar` maps to logical source `CC_PASAR`;
- workbook sheet `cc_prod` is structurally present but empty in the verified Company 2000 fixture and must not contribute to ADUM/PASAR;
- the verified TB layout exposes controlled headers `kode`, `descr`, and `amount`;
- authoritative SAP Cost Center fields are `Cost Elements` and `Act. Costs`; helper fields such as `CE` and `Act Amt` are not authoritative when raw fields are available;
- SAP Cost Center reported total is represented by `* Debit`;
- `** Over/Underabsorption` is a duplicate/control row and must not be counted as detail or as a second reported total;
- Company 2000 Engine 1 financial contribution is sourced from `CC_ADUM` and `CC_PASAR` only;
- Historical V1 excluded Derivatif and `CC_PROD`; current ENGINE1_2000_V2 final SI includes validated CC_DRV effects.

## Company 2000 application golden E2E

The real private source workbook has completed the deployed application flow:

`Upload → Validation → Source Reconciliation → Mapping → Calculation`

Historical V1 production result (superseded): ADUM `107,796,550,061`, PASAR `17,900,551,142`, TOTAL `125,697,101,203`.

Current verified `ENGINE1_2000_V2` golden result: ADUM `107,844,157,911`, PASAR `16,487,761,095`, TOTAL `124,331,919,006`; both Cost Groups reconcile with zero difference.

**GOLDEN ENGINE CONTRACT = PASS**

**GOLDEN WORKBOOK SOURCE STRUCTURE = PASS**

**GOLDEN WORKBOOK APPLICATION E2E = PASS**

The private workbook remains outside the repository.


## Engine 2 V2 analysis bases (2026-08-31)

Engine 2 derives only from a FINALIZED period and its active SUCCESS calculation run/upload. Company 2000 has one `SI` analysis basis (final Engine 1 V2 detail independently controlled against `AUDIT_SI`). Company 7000 has separate additive `GHOPO` and `DERIV` analysis bases: GHOPO retains finalized Engine 1 detail and is controlled against `AUDIT_GHOPO`; DERIV is parsed from `AUDIT_DERIV` on that same upload in Rp-thousand and normalized to full IDR. DERIV remains excluded from Company 7000 Engine 1 and is never a Cost Group.

The hierarchy and stable identity are Company -> Analysis Basis -> Cost Group -> Nature -> COA/calculated item. Keys are basis-qualified (`basis:<BASIS>:group:<id>:nature:<id>:...`) and monthly run/upload identity remains lineage, not node identity. All parity uses Decimal normalization to two financial decimal places. Missing source controls and non-reconciling finalized sources are integrity failures, while missing comparison periods remain `UNAVAILABLE`.

PR #23 remains HOLD. Its Phase I assumptions about legacy unqualified analysis keys are superseded; after Engine 2 V2 merges, Phase I must be rebased and adapted separately. Phase I materiality, commentary, and review are not part of this redesign.

### July 2026 Engine 2 V2 locked totals

| Company | Analysis basis | HPP | ADUM | PASAR | Basis/company total |
|---|---:|---:|---:|---:|---:|
| 2000 | SI | — | 107,844,157,911.00 | 16,487,761,095.00 | 124,331,919,006.00 |
| 7000 | GHOPO | 413,169,722,810.00 | 11,667,383,975.00 | 81,641,587,070.00 | 506,478,693,855.00 |
| 7000 | DERIV | 4,571,043,173.00 | 0.00 | 1,857,097,643.00 | 6,428,140,816.00 |
| 7000 | composite analytical total | — | — | — | 512,906,834,671.00 |

DERIV PASAR consists of 1,488,906,545.00 regular PASAR plus 368,191,098.00 OA. These are Engine 2 analytical values only; the Company 7000 Engine 1 total remains 506,478,693,855.00.
