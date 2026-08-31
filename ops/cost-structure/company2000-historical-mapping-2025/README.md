# Company 2000 Historical Mapping Backfill — Jan 2025 through Jun 2026

This package is an **operational data migration**, not an automatically executed Prisma migration.
Merging this directory does not change production data.

## Purpose

Create predecessor COA mappings for Company Code `2000` covering the inclusive interval:

- `validFrom`: `2025-01-01`
- `validTo`: `2026-06-30`

The existing Jul-2026 baseline mappings remain unchanged:

- `validFrom`: `2026-07-01`
- `validTo`: `NULL`

The interval boundary follows the application contract in `lib/cost-structure/mappings/effective-mapping.ts`, where `validTo` is inclusive and a predecessor ends on the day before the next mapping starts.

## Evidence locked by the audit

Production read-only audit on 2026-08-31 established:

- active Company 2000 Jan-2025 workbook SHA-256: `ac0358b1b43cb7233f2826986a097675819388981fe8b65f061d5f2a914484a3`
- 140 distinct non-zero `(source, COA)` pairs in `CC_ADUM` + `CC_PASAR`
- 121 pairs already have a Jul-2026 baseline mapping and are safe predecessor candidates
- 19 pairs require an explicit historical mapping decision
- 0 finalized Company 2000 periods exist between Jan-2025 and Jun-2026
- 0 existing active mapping overlap pairs existed before this plan
- all 159 Jul-2026 Company 2000 baseline mappings have one consistent creator lineage

The 19 explicit candidates were reconstructed against `AUDIT_SI`. With those candidates plus the 121 inherited mappings, every Jan-2025 ADUM/PASAR Nature and both totals reconcile exactly to `AUDIT_SI` with difference `0.00`.

## Files

1. `preflight.sql` — read-only guards. Must return `READY_TO_APPLY` before execution.
2. `apply.sql` — transactional, idempotent, fail-closed DML. Creates missing COA master rows only when required, inserts predecessor mappings, and writes one audit-log record.
3. `verify.sql` — read-only post-apply verification, including exact Nature parity against Jan-2025 `AUDIT_SI`.

## Safety properties

- No generated database IDs are hardcoded.
- Company, period, upload, COA, Cost Group, Nature, creator lineage, and baseline mappings are resolved by business keys/current authoritative rows.
- The Jan-2025 workbook is guarded by exact SHA-256.
- The script aborts if the Jul-2026 baseline no longer matches the audited state.
- The script aborts if any Company 2000 period in the affected historical interval is already `FINALIZED`.
- The script aborts on mapping overlap or conflicting predecessor mappings.
- The 2026-07-01 baseline mappings are never updated or deleted.
- Source rows are not directly rewritten. `Run reconciliation` remains the authoritative path that refreshes `coaId`, `mappingStatus`, and mapping issues after the predecessor mappings exist.
- No calculation, reconciliation, finalization, or period status transition is executed by this migration.

## Required operational sequence

1. Run `preflight.sql` against production.
2. Review the output and confirm `READY_TO_APPLY`.
3. Apply `apply.sql` in one transaction.
4. Run `verify.sql` and require all mapping/Nature differences to be zero.
5. Only after the application deployment containing failed-upload revalidation is live: open Jan-2025 upload → `Revalidate file` → `Run reconciliation`.
6. Calculate Jan-2025 separately and compare the Engine 1 result to the persisted `AUDIT_SI` before finalization.
