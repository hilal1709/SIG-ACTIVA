# Phase G — Finalization, Dashboard & Excel Export

Last updated: 2026-08-31

## Status

Phase G implements the presentation/finalization layer on top of persisted Engine 1 results. It does not own accounting formulas.

## Locked read path

```text
CostPeriod
  → activeCalculationRun (SUCCESS + active)
  → CostCalculationResult
  → CostActualLine / sourceReferenceJson
  → CostSourceRow / rawDataJson
```

Dashboard and Excel export are read-only consumers of data already produced during upload/reconciliation/calculation. They must never run Engine 1, mapping resolution, source reconciliation, or workbook accounting formulas when opened.

## Finalization lifecycle

```text
CALCULATED
  → COST_STRUCTURE_RECONCILED
  → FINALIZED
```

Reconciliation requires the active successful run, no unresolved blocking validation error, mapping/source readiness, required persisted totals, and required persisted controls at `RECONCILED / 0.00`.

Finalization revalidates those same persisted conditions inside the finalization transaction and confirms the active run ID has not changed. `FINALIZED` periods are immutable to calculation. Reopen requires ADMIN authorization and an explicit reason; it preserves the historical active successful run and returns the period to `CALCULATED` when that run remains valid.

All transitions are written to `CostAuditLog`.

## Dashboard

Dashboard reads only the active persisted run and presents:

- Company / fiscal period filters;
- HPP, ADUM, PASAR and TOTAL for Company 7000;
- ADUM, PASAR and TOTAL for Company 2000;
- period/run/rule-set status;
- persisted reconciliation controls;
- Cost Group → Nature → COA/formula/residual drill-down;
- persisted source/formula lineage;
- Reconcile / Finalize / Reopen workflow actions protected by existing API roles;
- official/draft Excel export.

For historical uploads created before audit-only persistence existed, the dashboard shows an ADMIN-only `Hydrate Audit Snapshot` action. That maintenance operation reads the authoritative private workbook once, verifies its SHA-256 against `CostUpload`, persists only `AUDIT_*` rows, and does not alter accounting amounts, mappings, active calculation run, or period status. It is never called by normal dashboard reads or by Excel export.

## Audit-only source persistence

Some workbook sheets are required for manual audit/export but intentionally have zero accounting contribution. They are persisted as optional audit-only `CostSourceRow` snapshots and never enter mapping/reconciliation/Engine 1:

### Company 2000

- `SI` → `AUDIT_SI`
- `rincian biaya` → `AUDIT_RINCIAN`
- `cc derivatif` → `AUDIT_CC_DRV`

### Company 7000

- `GHoPO` → `AUDIT_GHOPO`
- `DERIV` → `AUDIT_DERIV`
- `rincian biaya` → `AUDIT_RINCIAN`
- `cc_drv` → `AUDIT_CC_DRV`
- `SI2000_DRV` → `AUDIT_SI2000_DRV`

Derivative/audit-only rows have no COA mapping amount semantics and zero effect on HPP/ADUM/PASAR/TOTAL. New uploads are persisted with `mappingStatus=AUDIT_ONLY` for these rows.

## Company 7000 official export contract

`Cost_Structure_7000_YYYY-MM_<DRAFT|FINAL>.xlsx` contains:

1. `GHoPO`
2. `DERIV`
3. `rincian biaya`
4. `tb`
5. `cc_prod`
6. `cc_adm`
7. `cc pasar`
8. `cc_drv`
9. `SI2000_DRV`
10. `WHRPG`
11. `Batu bara`
12. `statistical pasar`
13. `beli`
14. `solar PP order`
15. `Formula Audit`

`GHoPO`, `DERIV`, and `rincian biaya` use the persisted golden-layout audit snapshot. Authoritative Cost Structure cells in `GHoPO` are overwritten from `CostCalculationResult`, displayed in the workbook's Rp-thousand presentation unit. No Excel formula is treated as accounting authority.

`Formula Audit` generically flattens persisted `sourceReferenceJson` and `calculationDetailJson`; new rule codes therefore remain auditable without implementing the accounting formula again in the exporter.

## Company 2000 export contract

The official export includes at least:

- `SI`
- `rincian biaya`
- `cc prod`
- `cc ADM`
- `cc pasar`
- `cc derivatif` when persisted
- `Formula Audit`

Authoritative ADUM/PASAR cells in `SI` are rendered from persisted Engine 1 results.

## Performance and security

Export does **not**:

- download the source workbook from Storage;
- parse XLSX/SheetJS at request time;
- calculate HPP/OA/coal/residual;
- resolve mapping;
- expose Storage object keys or Supabase service-role credentials.

Export does:

- query persisted DB rows;
- render an ExcelJS workbook;
- record `EXPORT_COST_STRUCTURE` in the audit log.

If mandatory persisted audit templates/lineage are unavailable, export fails explicitly rather than recalculating or silently substituting zero.
