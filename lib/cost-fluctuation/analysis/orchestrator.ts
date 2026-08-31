import { aggregateSnapshots } from './aggregate';
import { compareSnapshots } from './compare';
import { comparisonLabel, resolveComparisonMonths } from './periods';
import { buildFinalizedMonthlySnapshot } from './snapshot';
import type { AnalysisRepository, ComparisonType, MonthRef } from './types';

export function createAnalysisService(repository: AnalysisRepository) {
  return async function getAnalysis(periodId: number, comparisonType: ComparisonType) {
    const requested = await repository.findPeriodById(periodId);
    if (!requested) return { kind: 'NOT_FOUND' as const };
    if (requested.status !== 'FINALIZED') return { kind: 'INVALID_CURRENT' as const, status: requested.status };
    const currentRef: MonthRef = { fiscalYear: requested.fiscalYear, fiscalPeriod: requested.fiscalPeriod };
    const ranges = resolveComparisonMonths(currentRef, comparisonType);
    const load = async (months: MonthRef[]) => Promise.all(months.map(async (month) => ({ month, snapshot: buildFinalizedMonthlySnapshot(await repository.findPeriod(requested.companyId, month)) })));
    const [currentLoaded, comparisonLoaded] = await Promise.all([load(ranges.current), load(ranges.comparison)]);
    const missingPeriods = [...currentLoaded, ...comparisonLoaded].filter((item) => !item.snapshot).map((item) => item.month);
    const label = comparisonLabel(comparisonType, currentRef, ranges.comparison.at(-1)!);
    if (missingPeriods.length) return { kind: 'OK' as const, comparisonType, comparisonLabel: label, status: 'UNAVAILABLE' as const, current: currentRef, comparison: ranges.comparison, missingPeriods };
    const current = aggregateSnapshots(currentLoaded.map((item) => item.snapshot!)); const comparison = aggregateSnapshots(comparisonLoaded.map((item) => item.snapshot!));
    return { kind: 'OK' as const, comparisonType, comparisonLabel: label, status: 'AVAILABLE' as const, current: { periods: current.lineage }, comparison: { periods: comparison.lineage }, hierarchy: [compareSnapshots(current, comparison)] };
  };
}
