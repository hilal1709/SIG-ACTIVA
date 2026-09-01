import assert from 'node:assert/strict';
import test from 'node:test';
import type { ComparedNode } from '../analysis/types';
import { generateCommentary, selectParetoDrivers } from './generator';

const node = (key: string, variance: string, over: Partial<ComparedNode> = {}): ComparedNode => ({
  key,
  id: 1,
  code: key,
  label: key,
  nodeType: 'COA',
  order: 1,
  currentAmount: variance,
  comparisonAmount: '0',
  varianceAmount: variance,
  variancePercent: null,
  variancePercentStatus: 'NM',
  contribution: null,
  contributionStatus: 'PARENT_ZERO',
  contributionBasis: null,
  ...over,
});

test('Pareto ranks absolute variance, reaches 80%, keeps at least three and signed offsets', () => {
  const parent = node('nature', '100', { nodeType: 'NATURE', children: [node('b', '-20'), node('a', '80'), node('c', '10'), node('d', '1')] });
  const result = selectParetoDrivers(parent);
  assert.deepEqual(result.map((x) => x.key), ['a', 'b', 'c']);
  assert.equal(result[1].direction, 'OFFSET');
  assert.ok(result.reduce((x, d) => x + Number(d.grossImpactShare), 0) >= 0.8);
});

test('Pareto has one driver and deterministic key tie order', () => {
  assert.deepEqual(selectParetoDrivers(node('n', '5', { nodeType: 'NATURE', children: [node('only', '5')] })).map((x) => x.key), ['only']);
  const p = node('n', '3', { nodeType: 'NATURE', children: [node('z', '1'), node('a', '1'), node('m', '1')] });
  assert.deepEqual(selectParetoDrivers(p).map((x) => x.key), ['a', 'm', 'z']);
});

test('distributed movement is stated without pretending one driver dominates', () => {
  const p = node('n', '5', { nodeType: 'NATURE', comparisonAmount: '5', currentAmount: '10', variancePercent: '100', variancePercentStatus: 'AVAILABLE', children: [node('a', '1.9'), node('b', '1.8'), node('c', '1.3')] });
  assert.match(generateCommentary(p, 'MOM', 'Juli vs Juni', 'line')!.text, /tersebar pada beberapa driver/);
});

test('zero and NM movement language never invents percentages', () => {
  assert.equal(generateCommentary(node('zero', '0'), 'MOM', 'x', 'l'), null);
  const appeared = generateCommentary(node('new', '10'), 'MOM', 'x', 'l')!.text;
  assert.match(appeared, /muncul biaya/);
  assert.doesNotMatch(appeared, /%/);
  const gone = generateCommentary(node('gone', '-10', { currentAmount: '0', comparisonAmount: '10' }), 'YOY', 'x', 'l')!.text;
  assert.match(gone, /turun menjadi nol/);
});

test('net-zero parent describes offsetting movement without saying it decreased by zero', () => {
  const p = node('n', '0', {
    nodeType: 'NATURE',
    currentAmount: '100',
    comparisonAmount: '100',
    variancePercent: '0',
    variancePercentStatus: 'AVAILABLE',
    children: [node('60010001', '20', { code: '60010001', label: 'Services' }), node('60020001', '-20', { code: '60020001', label: 'Travel' })],
  });
  const result = generateCommentary(p, 'MOM', 'Juli vs Juni', 'line')!;
  assert.match(result.text, /secara neto tidak berubah/);
  assert.match(result.text, /pergeseran antar-driver/);
  assert.doesNotMatch(result.text, /menurun Rp0/);
  assert.equal(result.drivers.every((driver) => driver.direction === 'NEUTRAL'), true);
});

test('COA Pareto driver keeps its code in the generated narrative and metadata', () => {
  const p = node('n', '80', {
    nodeType: 'NATURE',
    currentAmount: '180',
    comparisonAmount: '100',
    children: [node('coa-driver', '80', { code: '67870004', label: 'Services Charge' })],
  });
  const result = generateCommentary(p, 'MOM', 'Juli vs Juni', 'line')!;
  assert.match(result.text, /COA 67870004 Services Charge/);
  assert.equal(result.drivers[0].code, '67870004');
});

test('calculated item uses its label and never invents a COA', () => {
  const result = generateCommentary(node('calc', '5', { nodeType: 'CALCULATED_ITEM', label: 'Selisih Persediaan', ruleCode: 'HPP_INVENTORY_DIFF_7000' }), 'YTD', 'x', 'l')!;
  assert.match(result.text, /Item perhitungan Selisih Persediaan/);
  assert.doesNotMatch(result.text, /COA/);
});
