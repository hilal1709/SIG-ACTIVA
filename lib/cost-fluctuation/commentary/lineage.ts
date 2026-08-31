import { Prisma } from '@prisma/client';
import type { ComparisonType, Lineage } from '../analysis/types';
import { lineageKey } from './context';

type Tx = Prisma.TransactionClient;
type LockedLineage = {
  id: number;
  companyCode: string;
  fiscalYear: number;
  fiscalPeriod: number;
  status: string;
  activeCalculationRunId: number | null;
  runId: number | null;
  uploadId: number | null;
  runStatus: string | null;
  isActive: boolean | null;
  ruleSetVersion: string | null;
};

const stale = () => new Error('Commentary lineage is stale.');

/** Locks every represented Cost Period and validates the complete Engine 2 V2 basis lineage at commit time. */
export async function assertCurrentLineage(
  tx: Tx,
  comparisonType: ComparisonType,
  current: Lineage[],
  comparison: Lineage[],
  expectedKey: string,
) {
  const expected = [...current, ...comparison];
  if (!expected.length) throw new Error('Analysis lineage is empty.');
  const ids = [...new Set(expected.map((line) => line.periodId))].sort((a, b) => a - b);

  await tx.$queryRaw(Prisma.sql`SELECT id FROM cost_periods WHERE id IN (${Prisma.join(ids)}) ORDER BY id FOR UPDATE`);
  const rows = await tx.$queryRaw<LockedLineage[]>(Prisma.sql`
    SELECT p.id, c."companyCode", p."fiscalYear", p."fiscalPeriod", p.status::text, p."activeCalculationRunId",
           r.id AS "runId", r."uploadId", r.status::text AS "runStatus", r."isActive", r."ruleSetVersion"
    FROM cost_periods p
    JOIN cost_companies c ON c.id = p."companyId"
    LEFT JOIN cost_calculation_runs r ON r.id = p."activeCalculationRunId"
    WHERE p.id IN (${Prisma.join(ids)})
    ORDER BY p.id
  `);
  if (rows.length !== ids.length) throw stale();

  for (const line of expected) {
    const row = rows.find((candidate) => candidate.id === line.periodId);
    if (
      !row ||
      row.status !== 'FINALIZED' ||
      row.activeCalculationRunId !== line.runId ||
      row.runId !== line.runId ||
      row.uploadId !== line.uploadId ||
      row.runStatus !== 'SUCCESS' ||
      row.isActive !== true ||
      row.ruleSetVersion !== line.ruleSetVersion ||
      row.fiscalYear !== line.fiscalYear ||
      row.fiscalPeriod !== line.fiscalPeriod
    ) throw stale();
  }

  for (const periodId of ids) {
    const row = rows.find((candidate) => candidate.id === periodId)!;
    const periodLines = expected.filter((line) => line.periodId === periodId);
    const actualBases = periodLines.map((line) => line.basisCode).sort();
    if (new Set(actualBases).size !== actualBases.length) throw stale();
    const requiredBases = row.companyCode === '2000' ? ['SI'] : row.companyCode === '7000' ? ['DERIV', 'GHOPO'] : null;
    if (!requiredBases || actualBases.length !== requiredBases.length || actualBases.some((basis, index) => basis !== requiredBases[index])) throw stale();
  }

  if (lineageKey(comparisonType, current, comparison) !== expectedKey) throw stale();
}
