# Golden Dataset — Engine 1

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

The private July-2026 workbooks were inspected without committing their contents. The following structural contracts are now verified and may be used by the parser/reconciliation code:

- workbook sheet `tb` maps to logical source `TB`;
- workbook sheet `cc_adm` maps to logical source `CC_ADUM`;
- workbook sheet `cc pasar` maps to logical source `CC_PASAR`;
- workbook sheet `cc_prod` is structurally present but empty in the verified Company 2000 fixture and must not contribute to ADUM/PASAR;
- the verified TB layout exposes controlled headers `kode`, `descr`, and `amount`;
- the verified SAP Cost Center layouts expose controlled helper headers `CE` and `Act Amt`, while `Cost Elements` retains source description text;
- SAP Cost Center reported total is represented by `* Debit`;
- `** Over/Underabsorption` is a duplicate/control row and must not be counted as detail or as a second reported total;
- Company 2000 Engine 1 financial contribution is sourced from `CC_ADUM` and `CC_PASAR` only;
- Derivatif and `CC_PROD` must have zero Company 2000 Cost Structure effect.

These are source-layout facts from the private golden workbook, not generalized fuzzy parser rules.

**GOLDEN ENGINE CONTRACT = IMPLEMENTED**

**GOLDEN WORKBOOK SOURCE STRUCTURE = VERIFIED**

**GOLDEN WORKBOOK APPLICATION E2E = PENDING**

The actual workbook fixture is confidential and must not be committed. A real application execution against the private workbook remains mandatory before Phase F begins. Do not fabricate a workbook or infer COA mappings from the expected totals.
