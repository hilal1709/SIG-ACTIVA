# Golden Dataset — Engine 1

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
- Derivatif and `CC_PROD` have zero Company 2000 Cost Structure effect.

## Company 2000 application golden E2E

The real private source workbook has completed the deployed application flow:

`Upload → Validation → Source Reconciliation → Mapping → Calculation`

Production result:

- active upload: validated;
- source reconciliation: difference `0` for CC_ADUM and CC_PASAR;
- active calculation run: `SUCCESS` / `ENGINE1_2000_V1`;
- ADUM: `107,796,550,061`;
- PASAR: `17,900,551,142`;
- TOTAL: `125,697,101,203`;
- ADUM reconciliation difference: `0`;
- PASAR reconciliation difference: `0`.

**GOLDEN ENGINE CONTRACT = PASS**

**GOLDEN WORKBOOK SOURCE STRUCTURE = PASS**

**GOLDEN WORKBOOK APPLICATION E2E = PASS**

The private workbook remains outside the repository.
