import { Prisma } from '@prisma/client';
import type { ComparisonType, Lineage } from '../analysis/types';
import { lineageKey } from './context';

type Tx = Prisma.TransactionClient;
type LockedLineage = { id: number; fiscalYear: number; fiscalPeriod: number; status: string; activeCalculationRunId: number | null; runId: number | null; runStatus: string | null; isActive: boolean | null; ruleSetVersion: string | null };

/** Locks every period represented by a Phase H lineage and verifies its active finalized run at commit time. */
export async function assertCurrentLineage(tx: Tx, comparisonType: ComparisonType, current: Lineage[], comparison: Lineage[], expectedKey: string) {
  const expected = [...current, ...comparison];
  if (!expected.length) throw new Error('Analysis lineage is empty.');
  const ids = expected.map((line) => line.periodId);
  await tx.$queryRaw(Prisma.sql`SELECT id FROM cost_periods WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
  const rows = await tx.$queryRaw<LockedLineage[]>(Prisma.sql`
    SELECT p.id, p."fiscalYear", p."fiscalPeriod", p.status::text, p."activeCalculationRunId",
           r.id AS "runId", r.status::text AS "runStatus", r."isActive", r."ruleSetVersion"
    FROM cost_periods p
    LEFT JOIN cost_calculation_runs r ON r.id = p."activeCalculationRunId"
    WHERE p.id IN (${Prisma.join(ids)})
    ORDER BY p.id
  `);
  if (rows.length !== new Set(ids).size) throw new Error('Commentary lineage is stale.');
  for (const line of expected) {
    const row = rows.find((candidate) => candidate.id === line.periodId);
    if (!row || row.status !== 'FINALIZED' || row.activeCalculationRunId !== line.runId || row.runId !== line.runId || row.runStatus !== 'SUCCESS' || row.isActive !== true || row.ruleSetVersion !== line.ruleSetVersion || row.fiscalYear !== line.fiscalYear || row.fiscalPeriod !== line.fiscalPeriod) throw new Error('Commentary lineage is stale.');
  }
  if (lineageKey(comparisonType, current, comparison) !== expectedKey) throw new Error('Commentary lineage is stale.');
}
