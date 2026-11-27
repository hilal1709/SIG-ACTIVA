import { resolveComparisonMonths } from '../analysis/periods';
import type { MonthRef } from '../analysis/types';

/** Uses the Engine 2 resolver directly so readiness cannot drift from analysis semantics. */
export function resolveReadinessDependencies(current: MonthRef) {
  return {
    mom: resolveComparisonMonths(current, 'MOM').comparison,
    yoy: resolveComparisonMonths(current, 'YOY').comparison,
    // Engine 2 requires both complete Jan-current ranges for YTD.
    ytd: resolveComparisonMonths(current, 'YTD'),
  };
}
