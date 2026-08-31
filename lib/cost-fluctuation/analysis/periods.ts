import type { ComparisonType, MonthRef } from './types';

export function resolveComparisonMonths(current: MonthRef, type: ComparisonType) {
  if (type === 'MOM') {
    const comparison = current.fiscalPeriod === 1
      ? { fiscalYear: current.fiscalYear - 1, fiscalPeriod: 12 }
      : { fiscalYear: current.fiscalYear, fiscalPeriod: current.fiscalPeriod - 1 };
    return { current: [current], comparison: [comparison] };
  }
  if (type === 'YOY') return { current: [current], comparison: [{ fiscalYear: current.fiscalYear - 1, fiscalPeriod: current.fiscalPeriod }] };
  return {
    current: Array.from({ length: current.fiscalPeriod }, (_, index) => ({ fiscalYear: current.fiscalYear, fiscalPeriod: index + 1 })),
    comparison: Array.from({ length: current.fiscalPeriod }, (_, index) => ({ fiscalYear: current.fiscalYear - 1, fiscalPeriod: index + 1 })),
  };
}

export function comparisonLabel(type: ComparisonType, current: MonthRef, comparison: MonthRef) {
  const names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = (value: MonthRef) => `${names[value.fiscalPeriod - 1]}-${value.fiscalYear}`;
  return type === 'YTD' ? `YTD: Jan-${month(current)} vs Jan-${month(comparison)}` : `${type === 'MOM' ? 'MoM' : 'YoY'}: ${month(current)} vs ${month(comparison)}`;
}
