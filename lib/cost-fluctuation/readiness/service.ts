import { resolveReadinessDependencies } from './period-dependencies';
import type { ComparisonReadiness, CurrentPeriodReadiness, PeriodCheck, ReadinessMatrix, ReadinessPeriod, ReadinessState } from './types';

export interface ReadinessRepository { findAll(): Promise<ReadinessPeriod[]> }

const key = (companyId: number, year: number, period: number) => `${companyId}:${year}:${period}`;
const monthName = (period: number) => ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][period - 1];
const label = (year: number, period: number) => `${monthName(period)}-${year}`;

export function classifyPeriod(period: ReadinessPeriod | undefined): Pick<PeriodCheck, 'readiness' | 'reason'> {
  if (!period) return { readiness: 'MISSING', reason: 'Periode Cost Structure belum tersedia.' };
  if (period.status !== 'FINALIZED') return { readiness: 'NOT_FINALIZED', reason: `Periode tersedia tetapi berstatus ${period.status}, belum FINALIZED.` };
  const run = period.activeRun;
  if (!run || period.activeCalculationRunId !== run.id || run.periodId !== period.id || run.status !== 'SUCCESS' || !run.isActive) {
    return { readiness: 'INVALID_ACTIVE_RUN', reason: 'Periode FINALIZED tidak memiliki active calculation run SUCCESS yang otoritatif.' };
  }
  return { readiness: 'AVAILABLE', reason: 'Periode FINALIZED dengan active calculation run SUCCESS yang otoritatif.' };
}

const priority: ReadinessState[] = ['MISSING', 'NOT_FINALIZED', 'INVALID_ACTIVE_RUN', 'AVAILABLE'];

export function createReadinessService(repository: ReadinessRepository) {
  return async function getReadiness(): Promise<ReadinessMatrix> {
    const periods = await repository.findAll();
    const indexed = new Map(periods.map((period) => [key(period.companyId, period.fiscalYear, period.fiscalPeriod), period]));
    const check = (companyId: number, fiscalYear: number, fiscalPeriod: number): PeriodCheck => {
      const period = indexed.get(key(companyId, fiscalYear, fiscalPeriod));
      return { fiscalYear, fiscalPeriod, periodId: period?.id ?? null, status: period?.status ?? null, ...classifyPeriod(period) };
    };
    const summarize = (required: PeriodCheck[]): ComparisonReadiness => {
      const group = (state: ReadinessState) => required.filter((item) => item.readiness === state);
      return {
        readiness: priority.find((state) => group(state).length > 0) ?? 'AVAILABLE', required,
        available: group('AVAILABLE'), missing: group('MISSING'), nonFinalized: group('NOT_FINALIZED'), invalidActiveRuns: group('INVALID_ACTIVE_RUN'),
      };
    };
    const result: CurrentPeriodReadiness[] = periods.map((period) => {
      const dependencies = resolveReadinessDependencies(period);
      const refs = (values: Array<{ fiscalYear: number; fiscalPeriod: number }>) => values.map((item) => check(period.companyId, item.fiscalYear, item.fiscalPeriod));
      // Engine 2 YTD loads every current-year and prior-year constituent month.
      const ytdRequired = [...dependencies.ytd.current, ...dependencies.ytd.comparison];
      return {
        companyCode: period.companyCode, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod,
        periodId: period.id, status: period.status, finalized: period.status === 'FINALIZED', activeRun: period.activeRun,
        currentReadiness: classifyPeriod(period).readiness,
        mom: summarize(refs(dependencies.mom)), yoy: summarize(refs(dependencies.yoy)), ytd: summarize(refs(ytdRequired)),
      };
    }).sort((a, b) => b.fiscalYear - a.fiscalYear || b.fiscalPeriod - a.fiscalPeriod || a.companyCode.localeCompare(b.companyCode));
    return { periods: result, companies: [...new Set(result.map((item) => item.companyCode))].sort() };
  };
}

export { label as readinessPeriodLabel };
