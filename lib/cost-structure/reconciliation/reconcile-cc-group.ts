import { classifySourceRow } from './source-control-registry';
import { fromMinor, toMinor } from './money';
import type { ReconciliationResult, SourceRow } from './types';

export function reconcileCcGroup(rows: SourceRow[]): ReconciliationResult {
  const classified = rows.map(classifySourceRow);
  const details = classified.filter((row) => row.kind === 'DETAIL');
  const totals = classified.filter((row) => row.kind === 'REPORTED_TOTAL' && row.amount !== null);
  const detail = details.reduce((sum, row) => sum + toMinor(row.amount), BigInt(0));
  const controlRowCount = classified.length - details.length;
  if (totals.length === 0) return { status: 'MISSING_TOTAL', detailRowCount: details.length, controlRowCount, detailAmount: fromMinor(detail), reportedAmount: null, difference: null, issueCode: 'CC_GROUP_TOTAL_NOT_FOUND' };
  if (totals.length > 1) return { status: 'AMBIGUOUS_TOTAL', detailRowCount: details.length, controlRowCount, detailAmount: fromMinor(detail), reportedAmount: null, difference: null, issueCode: 'CC_GROUP_TOTAL_AMBIGUOUS' };
  const reported = toMinor(totals[0].amount);
  const difference = detail - reported;
  return { status: difference === BigInt(0) ? 'RECONCILED' : 'NOT_RECONCILED', detailRowCount: details.length, controlRowCount, detailAmount: fromMinor(detail), reportedAmount: fromMinor(reported), difference: fromMinor(difference), issueCode: difference === BigInt(0) ? null : 'CC_GROUP_NOT_RECONCILED' };
}
