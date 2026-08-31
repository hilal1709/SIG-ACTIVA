import { prisma } from '../../prisma';
import { ZERO } from './math';
import type { AnalyticalSnapshot, MonthRef, SnapshotGroup, SnapshotItem, SnapshotNature } from './types';

export class FluctuationIntegrityError extends Error {}

export function assertSnapshotReconciles(snapshot: AnalyticalSnapshot) {
  const groupSum = snapshot.groups.reduce((sum, group) => sum.add(group.amount), ZERO);
  if (!groupSum.equals(snapshot.amount)) throw new FluctuationIntegrityError(`Company ${snapshot.companyCode} snapshot does not reconcile to its Cost Groups.`);
  for (const group of snapshot.groups) {
    const natureSum = group.natures.reduce((sum, nature) => sum.add(nature.amount), ZERO);
    if (!natureSum.equals(group.amount)) throw new FluctuationIntegrityError(`Cost Group ${group.code} does not reconcile to its Natures.`);
    for (const nature of group.natures) {
      const itemSum = nature.items.reduce((sum, item) => sum.add(item.amount), ZERO);
      if (!itemSum.equals(nature.amount)) throw new FluctuationIntegrityError(`Nature ${nature.code} does not reconcile to its analytical items.`);
    }
  }
}

export async function loadFinalizedMonthlySnapshot(companyId: number, month: MonthRef): Promise<AnalyticalSnapshot | null> {
  const period = await prisma.costPeriod.findUnique({
    where: { companyId_fiscalYear_fiscalPeriod: { companyId, ...month } },
    include: { company: true, activeCalculationRun: { include: { results: { include: { costGroup: true, nature: true } }, actualLines: { include: { costGroup: true, nature: true, coa: true } } } } },
  });
  if (!period || period.status !== 'FINALIZED') return null;
  const run = period.activeCalculationRun;
  if (!run || run.status !== 'SUCCESS' || !run.isActive || run.periodId !== period.id) throw new FluctuationIntegrityError(`Finalized period ${period.id} has invalid active calculation-run lineage.`);
  const companyTotal = run.results.find((result) => result.resultType === 'TOTAL' && result.resultCode === 'TOTAL_COMPANY');
  if (!companyTotal) throw new FluctuationIntegrityError(`Finalized period ${period.id} has no TOTAL_COMPANY result.`);
  const groupResults = run.results.filter((result) => result.resultType === 'TOTAL' && result.costGroupId && result.resultCode.startsWith('TOTAL_'));
  const groups: SnapshotGroup[] = groupResults.map((groupResult) => {
    const natureResults = run.results.filter((result) => result.resultType === 'NATURE' && result.costGroupId === groupResult.costGroupId && result.natureId);
    return {
      key: `group:${groupResult.costGroupId}`, id: groupResult.costGroupId, code: groupResult.costGroup!.code, label: groupResult.costGroup!.name, amount: groupResult.amount,
      natures: natureResults.map((natureResult): SnapshotNature => {
        const grouped = new Map<string, SnapshotItem>();
        for (const line of run.actualLines.filter((item) => item.natureId === natureResult.natureId)) {
          const key = line.coaId ? `coa:${line.coaId}` : `calculated:${line.natureId}:${line.lineType}:${line.ruleCode ?? 'NO_RULE'}`;
          const existing = grouped.get(key);
          const code = line.coa?.coaCode ?? line.ruleCode ?? line.lineType;
          grouped.set(key, { key, id: line.coaId, code, label: line.coa?.coaDescription ?? line.ruleCode ?? `${line.lineType} item`, amount: (existing?.amount ?? ZERO).add(line.finalAmount), lineType: line.lineType, ruleCode: line.ruleCode });
        }
        return { key: `nature:${natureResult.natureId}`, id: natureResult.natureId, code: natureResult.nature!.code, label: natureResult.nature!.name, amount: natureResult.amount, items: [...grouped.values()] };
      }),
    };
  });
  const snapshot = { companyId, companyCode: period.company.companyCode, amount: companyTotal.amount, groups, lineage: [{ periodId: period.id, ...month, runId: run.id, ruleSetVersion: run.ruleSetVersion }] };
  assertSnapshotReconciles(snapshot);
  return snapshot;
}
