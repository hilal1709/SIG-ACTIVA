import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { resolveComparisonMonths } from './periods';
import { variance } from './math';
import { aggregateSnapshots } from './aggregate';
import { compareSnapshots } from './compare';
import type { AnalyticalSnapshot } from './types';

const d = (value: string) => new Prisma.Decimal(value);
const snapshot = (company: string, companyAmount: string, groupAmount: string, natureAmount: string, itemAmount: string, itemKey = 'coa:1'): AnalyticalSnapshot => ({
  companyId: 1, companyCode: company, amount: d(companyAmount), lineage: [{ periodId: 1, fiscalYear: 2026, fiscalPeriod: 7, runId: 1, ruleSetVersion: 'V1' }],
  groups: [{ key: 'group:1', id: 1, code: 'ADUM', label: 'ADUM', amount: d(groupAmount), natures: [{ key: 'nature:1', id: 1, code: 'N1', label: 'Nature', amount: d(natureAmount), items: [{ key: itemKey, id: itemKey.startsWith('coa') ? 1 : null, code: 'ITEM', label: 'Item', amount: d(itemAmount), lineType: itemKey.startsWith('coa') ? 'COA' : 'RESIDUAL', ruleCode: itemKey.startsWith('coa') ? null : 'RESIDUAL_RULE' }] }] }],
});

test('period resolution handles January rollover and complete YTD ranges', () => {
  assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 1 }, 'MOM').comparison, [{ fiscalYear: 2025, fiscalPeriod: 12 }]);
  const ytd = resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'YTD');
  assert.equal(ytd.current.length, 7); assert.deepEqual(ytd.comparison.at(-1), { fiscalYear: 2025, fiscalPeriod: 7 });
});

test('variance uses absolute comparison denominator and explicit NM semantics', () => {
  assert.deepEqual(variance(d('-80'), d('-100')), { amount: d('20'), percent: '20.000000', status: 'AVAILABLE' });
  assert.deepEqual(variance(d('100'), d('0')), { amount: d('100'), percent: null, status: 'NM' });
  assert.deepEqual(variance(d('0'), d('0')), { amount: d('0'), percent: '0.000000', status: 'AVAILABLE' });
});

test('comparison uses union keys, exact decimals, signed contribution, and parent-zero status', () => {
  const current = snapshot('2000', '120', '120', '120', '120', 'coa:2');
  const prior = snapshot('2000', '100', '100', '100', '100', 'coa:1');
  const company = compareSnapshots(current, prior); const nature = company.children![0].children![0];
  assert.equal(company.varianceAmount, '20.00');
  assert.deepEqual(nature.children!.map((item) => [item.key, item.currentAmount, item.comparisonAmount, item.variancePercentStatus]), [['coa:1', '0.00', '100.00', 'AVAILABLE'], ['coa:2', '120.00', '0.00', 'NM']]);
  assert.equal(nature.children![0].contribution, '-500.000000');
  const unchanged = compareSnapshots(snapshot('2000', '0', '0', '0', '1'), snapshot('2000', '0', '0', '0', '1'));
  assert.equal(unchanged.children![0].contributionStatus, 'PARENT_ZERO');
});

test('YTD aggregation preserves calculated identities and uses Decimal addition', () => {
  const result = aggregateSnapshots([snapshot('7000', '0.10', '0.10', '0.10', '0.10', 'calculated:1:RESIDUAL:R'), snapshot('7000', '0.20', '0.20', '0.20', '0.20', 'calculated:1:RESIDUAL:R')]);
  assert.equal(result.amount.toFixed(2), '0.30'); assert.equal(result.groups[0].natures[0].items[0].amount.toFixed(2), '0.30');
  assert.equal(result.groups[0].natures[0].items[0].id, null);
});
