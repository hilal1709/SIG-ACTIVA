import { ZERO } from './math';
import type { AnalyticalSnapshot, PersistedPeriod, SnapshotGroup, SnapshotItem, SnapshotNature } from './types';

export class FluctuationIntegrityError extends Error {}
const CANONICAL: Record<string, readonly string[]> = { '2000': ['TOTAL_ADUM', 'TOTAL_PASAR'], '7000': ['TOTAL_HPP', 'TOTAL_ADUM', 'TOTAL_PASAR'] };
const byOrder = <T extends { order: number; code: string; key: string }>(a: T, b: T) => a.order - b.order || a.code.localeCompare(b.code) || a.key.localeCompare(b.key);

export function assertSnapshotReconciles(snapshot: AnalyticalSnapshot) {
  const groupSum = snapshot.groups.reduce((sum, group) => sum.add(group.amount), ZERO);
  if (!groupSum.equals(snapshot.amount)) throw new FluctuationIntegrityError(`Company ${snapshot.companyCode} snapshot does not reconcile to its Cost Groups.`);
  for (const group of snapshot.groups) {
    if (!group.natures.reduce((sum, nature) => sum.add(nature.amount), ZERO).equals(group.amount)) throw new FluctuationIntegrityError(`Cost Group ${group.code} does not reconcile to its Natures.`);
    for (const nature of group.natures) if (!nature.items.reduce((sum, item) => sum.add(item.amount), ZERO).equals(nature.amount)) throw new FluctuationIntegrityError(`Nature ${nature.code} does not reconcile to its analytical items.`);
  }
}

export function buildFinalizedMonthlySnapshot(period: PersistedPeriod | null): AnalyticalSnapshot | null {
  if (!period || period.status !== 'FINALIZED') return null;
  const run = period.activeRun;
  if (!run || period.activeCalculationRunId !== run.id || run.periodId !== period.id || run.status !== 'SUCCESS' || !run.isActive) throw new FluctuationIntegrityError(`Finalized period ${period.id} has invalid active calculation-run lineage.`);
  const allowed = CANONICAL[period.companyCode];
  if (!allowed) throw new FluctuationIntegrityError(`Company ${period.companyCode} is outside the Engine 2 scope.`);
  const companyTotals = run.results.filter((result) => result.resultType === 'TOTAL' && result.resultCode === 'TOTAL_COMPANY');
  if (companyTotals.length !== 1) throw new FluctuationIntegrityError(`Finalized period ${period.id} must have exactly one TOTAL_COMPANY result.`);
  const canonical = run.results.filter((result) => result.resultType === 'TOTAL' && allowed.includes(result.resultCode));
  if (canonical.length !== allowed.length) throw new FluctuationIntegrityError(`Company ${period.companyCode} does not have its canonical Cost Group structure.`);
  if (new Set(canonical.map((result) => result.costGroupId)).size !== canonical.length || canonical.some((result) => !result.costGroupId || !result.costGroup)) throw new FluctuationIntegrityError('Duplicate or invalid canonical Cost Group total identity.');
  if (canonical.some((result) => result.resultCode !== `TOTAL_${result.costGroup!.code}`)) throw new FluctuationIntegrityError('Canonical total code does not match its stable Cost Group identity.');
  if (period.companyCode === '2000' && canonical.some((result) => result.resultCode === 'TOTAL_HPP')) throw new FluctuationIntegrityError('Company 2000 must not contain HPP.');

  const groups: SnapshotGroup[] = canonical.map((groupResult) => {
    const natureResults = run.results.filter((result) => result.resultType === 'NATURE' && result.costGroupId === groupResult.costGroupId && result.natureId && result.nature);
    const natures = natureResults.map((natureResult): SnapshotNature => {
      const grouped = new Map<string, SnapshotItem>();
      for (const line of run.actualLines.filter((item) => item.costGroupId === groupResult.costGroupId && item.natureId === natureResult.natureId)) {
        const key = line.coaId ? `coa:${line.coaId}` : `calculated:${line.natureId}:${line.lineType}:${line.ruleCode ?? 'NO_RULE'}`;
        const existing = grouped.get(key); const code = line.coa?.coaCode ?? line.ruleCode ?? line.lineType;
        grouped.set(key, { key, id: line.coaId, code, label: line.coa?.coaDescription ?? line.ruleCode ?? `${line.lineType} item`, amount: (existing?.amount ?? ZERO).add(line.finalAmount), order: line.coaId ? 0 : 1, lineType: line.lineType, ruleCode: line.ruleCode });
      }
      return { key: `nature:${natureResult.natureId}`, id: natureResult.natureId, code: natureResult.nature!.code, label: natureResult.nature!.name, amount: natureResult.amount, order: natureResult.nature!.displayOrder, items: [...grouped.values()].sort(byOrder) };
    }).sort(byOrder);
    return { key: `group:${groupResult.costGroupId}`, id: groupResult.costGroupId, code: groupResult.costGroup!.code, label: groupResult.costGroup!.name, amount: groupResult.amount, order: groupResult.costGroup!.displayOrder, natures };
  }).sort(byOrder);
  const snapshot = { companyId: period.companyId, companyCode: period.companyCode, amount: companyTotals[0].amount, groups, lineage: [{ periodId: period.id, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, runId: run.id, ruleSetVersion: run.ruleSetVersion }] };
  assertSnapshotReconciles(snapshot); return snapshot;
}
