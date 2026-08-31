import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { availableYears, canShowCalculationAction, displayGroupCodes, filterPeriods, groupPeriods, initialExpandedPeriod, latestYear, nextExpandedPeriod } from './explorer-utils';
import type { MonthlyPeriod } from './types';

const period = (id: number, companyCode: string, fiscalYear: number, fiscalPeriod: number, status = 'CALCULATED', errorMessage: string | null = null): MonthlyPeriod => ({
  id, companyCode, fiscalYear, fiscalPeriod, status, upload: { version: 1, status: 'VALIDATED' },
  run: { runNumber: 1, status: errorMessage ? 'FAILED' : 'SUCCESS', ruleSetVersion: 'v1', completedAt: null, errorMessage, actualLineCount: 1, results: [] },
});
const periods = [period(1, '2000', 2025, 1), period(2, '7000', 2026, 2, 'FINALIZED'), period(3, '2000', 2026, 1, 'SOURCE_RECONCILED')];

test('groups periods by company', () => assert.deepEqual(Object.keys(groupPeriods(periods)).sort(), ['2000', '7000']));
test('filters by company', () => assert.deepEqual(filterPeriods(periods, '2000', null, 'ALL').map((p) => p.id), [3, 1]));
test('filters by year', () => assert.deepEqual(filterPeriods(periods, 'ALL', 2025, 'ALL').map((p) => p.id), [1]));
test('defaults to the latest actual year and derives company years', () => { assert.equal(latestYear(periods), 2026); assert.deepEqual(availableYears(periods, '2000'), [2026, 2025]); });
test('sorts newest fiscal periods first', () => assert.deepEqual(filterPeriods([period(4, '2000', 2026, 12), period(5, '2000', 2026, 3)], 'ALL', 2026, 'ALL').map((p) => p.id), [4, 5]));
test('accordion expands one selected detail and collapses it', () => { assert.equal(nextExpandedPeriod(null, 1), 1); assert.equal(nextExpandedPeriod(1, 2), 2); assert.equal(nextExpandedPeriod(2, 2), null); });
test('error period is represented and initially expanded', () => assert.equal(initialExpandedPeriod([periods[0], period(6, '7000', 2026, 3, 'CALCULATED', 'blocked')]), 6));
test('company result sections preserve 2000 and 7000 scope', () => { assert.deepEqual(displayGroupCodes('2000'), ['ADUM', 'PASAR', 'TOTAL']); assert.deepEqual(displayGroupCodes('7000'), ['HPP', 'ADUM', 'PASAR', 'TOTAL']); });
test('empty data has no latest year or groups', () => { assert.equal(latestYear([]), null); assert.deepEqual(groupPeriods([]), {}); });
test('calculation action eligibility preserves existing period and company restrictions', () => { assert.equal(canShowCalculationAction(periods[2]), true); assert.equal(canShowCalculationAction(periods[1]), false); assert.equal(canShowCalculationAction(period(9, '9999', 2026, 1, 'CALCULATED')), false); });
test('mobile layout retains overflow guards and comfortable tap target', () => { const source = readFileSync('components/cost-structure/monthly/company-period-group.tsx', 'utf8'); assert.match(source, /min-w-0 overflow-hidden/); assert.match(source, /min-h-14 w-full min-w-0/); });
test('status badge always renders visible status text and an icon', () => { const source = readFileSync('components/cost-structure/monthly/status-badge.tsx', 'utf8'); assert.match(source, /Icon className/); assert.match(source, /normalized\.replaceAll/); });
