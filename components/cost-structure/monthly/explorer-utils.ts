import type { MonthlyPeriod } from './types';

export const availableYears = (periods: MonthlyPeriod[], company = 'ALL') =>
  [...new Set(periods.filter((period) => company === 'ALL' || period.companyCode === company).map((period) => period.fiscalYear))]
    .sort((a, b) => b - a);

export const latestYear = (periods: MonthlyPeriod[], company = 'ALL') => availableYears(periods, company)[0] ?? null;

export function filterPeriods(periods: MonthlyPeriod[], company: string, year: number | null, status: string) {
  return periods
    .filter((period) => company === 'ALL' || period.companyCode === company)
    .filter((period) => year === null || period.fiscalYear === year)
    .filter((period) => status === 'ALL' || period.status === status)
    .sort((a, b) => b.fiscalYear - a.fiscalYear || b.fiscalPeriod - a.fiscalPeriod);
}

export function groupPeriods(periods: MonthlyPeriod[]) {
  return periods.reduce<Record<string, MonthlyPeriod[]>>((groups, period) => {
    (groups[period.companyCode] ??= []).push(period);
    return groups;
  }, {});
}

export const isBlocked = (period: MonthlyPeriod) => period.run?.status === 'FAILED' || Boolean(period.run?.errorMessage);
export const displayGroupCodes = (companyCode: string) => companyCode === '7000' ? ['HPP', 'ADUM', 'PASAR', 'TOTAL'] : ['ADUM', 'PASAR', 'TOTAL'];
export const initialExpandedPeriod = (periods: MonthlyPeriod[]) => periods.find(isBlocked)?.id ?? null;
export const nextExpandedPeriod = (current: number | null, selected: number) => current === selected ? null : selected;
export const canShowCalculationAction = (period: MonthlyPeriod) =>
  ['2000', '7000'].includes(period.companyCode) && ['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status);
