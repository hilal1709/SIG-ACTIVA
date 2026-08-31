import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { resolveComparisonMonths, comparisonLabel } from './periods';
import { variance } from './math';
import { buildFinalizedMonthlySnapshot, FluctuationIntegrityError } from './snapshot';
import { compareSnapshots } from './compare';
import { createAnalysisService } from './orchestrator';
import type { AnalysisRepository, PersistedLine, PersistedPeriod, PersistedResult } from './types';

const d = (value: string | number) => new Prisma.Decimal(value);
const GROUPS = { HPP: { id: 30, order: 1 }, ADUM: { id: 10, order: 2 }, PASAR: { id: 20, order: 3 } } as const;
type GroupCode = keyof typeof GROUPS;

function period(companyCode: '2000' | '7000', fiscalYear: number, fiscalPeriod: number, options: { status?: string; runStatus?: string; isActive?: boolean; corruptRun?: boolean; extraSubtotal?: boolean; reverseResults?: boolean } = {}): PersistedPeriod {
  const codes: GroupCode[] = companyCode === '2000' ? ['ADUM', 'PASAR'] : ['HPP', 'ADUM', 'PASAR'];
  const results: PersistedResult[] = []; const actualLines: PersistedLine[] = [];
  for (const code of codes) {
    const group = GROUPS[code]; const natureId = group.id + 100; const amount = code === 'HPP' ? 30 : code === 'ADUM' ? 10 : 20;
    results.push({ costGroupId: group.id, natureId: null, resultCode: `TOTAL_${code}`, resultType: 'TOTAL', amount: d(amount), costGroup: { code, name: code, displayOrder: group.order }, nature: null });
    // Deliberately reverse lexical IDs versus display order.
    results.push({ costGroupId: group.id, natureId, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(amount), costGroup: { code, name: code, displayOrder: group.order }, nature: { code: `${code}_N`, name: `${code} Nature`, displayOrder: code === 'HPP' ? 9 : group.order } });
    actualLines.push({ costGroupId: group.id, natureId, coaId: group.id + 1000, lineType: 'COA', finalAmount: d(amount), ruleCode: null, coa: { coaCode: String(9000 - group.id), coaDescription: `${code} COA` } });
  }
  const total = companyCode === '2000' ? 30 : 60;
  results.push({ costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL', amount: d(total), costGroup: null, nature: null });
  if (options.extraSubtotal) results.push({ costGroupId: GROUPS.PASAR.id, natureId: null, resultCode: 'TOTAL_PASAR_REGULAR', resultType: 'TOTAL', amount: d(999), costGroup: { code: 'PASAR', name: 'PASAR', displayOrder: 3 }, nature: null });
  if (options.reverseResults) results.reverse();
  const id = fiscalYear * 100 + fiscalPeriod + (companyCode === '7000' ? 1_000_000 : 0); const runId = id + 10;
  return { id, companyId: companyCode === '2000' ? 1 : 2, companyCode, fiscalYear, fiscalPeriod, status: options.status ?? 'FINALIZED', activeCalculationRunId: runId, activeRun: { id: runId, periodId: options.corruptRun ? id + 1 : id, status: options.runStatus ?? 'SUCCESS', isActive: options.isActive ?? true, ruleSetVersion: `ENGINE1_${companyCode}_V1`, results: options.reverseResults ? results : results.reverse(), actualLines } };
}

function repository(periods: PersistedPeriod[]): AnalysisRepository {
  return { async findPeriodById(id) { return periods.find((item) => item.id === id) ?? null; }, async findPeriod(companyId, month) { return periods.find((item) => item.companyId === companyId && item.fiscalYear === month.fiscalYear && item.fiscalPeriod === month.fiscalPeriod) ?? null; } };
}

test('E2-001..004 resolve normal MoM, January rollover, YoY, and complete YTD with human labels', () => {
  assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'MOM').comparison, [{ fiscalYear: 2026, fiscalPeriod: 6 }]);
  assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 1 }, 'MOM').comparison, [{ fiscalYear: 2025, fiscalPeriod: 12 }]);
  assert.deepEqual(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'YOY').comparison, [{ fiscalYear: 2025, fiscalPeriod: 7 }]);
  assert.equal(resolveComparisonMonths({ fiscalYear: 2026, fiscalPeriod: 7 }, 'YTD').current.length, 7);
  assert.equal(comparisonLabel('MOM', { fiscalYear: 2026, fiscalPeriod: 7 }, { fiscalYear: 2026, fiscalPeriod: 6 }), 'MoM: Jul-2026 vs Jun-2026');
  assert.equal(comparisonLabel('YOY', { fiscalYear: 2026, fiscalPeriod: 7 }, { fiscalYear: 2025, fiscalPeriod: 7 }), 'YoY: Jul-2026 vs Jul-2025');
  assert.equal(comparisonLabel('YTD', { fiscalYear: 2026, fiscalPeriod: 7 }, { fiscalYear: 2025, fiscalPeriod: 7 }), 'YTD: Jan-Jul-2026 vs Jan-Jul-2025');
});

test('variance preserves exact signed arithmetic and zero-denominator statuses', () => {
  assert.equal(variance(d('-80'), d('-100')).percent, '20.000000');
  assert.deepEqual(variance(d('100'), d('0')).status, 'NM'); assert.equal(variance(d('0'), d('0')).percent, '0.000000');
});

test('canonical structures exclude future subtotal and preserve CostGroup displayOrder', () => {
  const company2000 = buildFinalizedMonthlySnapshot(period('2000', 2026, 7, { extraSubtotal: true }))!;
  assert.deepEqual(company2000.groups.map((group) => group.code), ['ADUM', 'PASAR']); assert.ok(!company2000.groups.some((group) => group.code === 'HPP'));
  const company7000 = buildFinalizedMonthlySnapshot(period('7000', 2026, 7))!;
  assert.deepEqual(company7000.groups.map((group) => group.code), ['HPP', 'ADUM', 'PASAR']);
  assert.ok(!JSON.stringify(company7000).includes('DERIV'));
});

test('duplicate or mismatched canonical Cost Group identities fail integrity validation', () => {
  const duplicate = period('2000', 2026, 7); duplicate.activeRun!.results.push({ ...duplicate.activeRun!.results.find((item) => item.resultCode === 'TOTAL_ADUM')! });
  assert.throws(() => buildFinalizedMonthlySnapshot(duplicate), FluctuationIntegrityError);
  const mismatch = period('2000', 2026, 7); mismatch.activeRun!.results.find((item) => item.resultCode === 'TOTAL_ADUM')!.costGroup = { code: 'PASAR', name: 'PASAR', displayOrder: 3 };
  assert.throws(() => buildFinalizedMonthlySnapshot(mismatch), /does not match its stable Cost Group identity/);
});

test('Nature display order and deterministic COA/calculated item order are preserved', () => {
  const raw = period('2000', 2026, 7); const run = raw.activeRun!;
  const adum = run.results.find((item) => item.resultType === 'NATURE' && item.costGroup?.code === 'ADUM')!; const secondNatureId = 999;
  run.results.push({ ...adum, natureId: secondNatureId, amount: d(0), nature: { code: 'FIRST', name: 'First', displayOrder: 0 } });
  const snapshot = buildFinalizedMonthlySnapshot(raw)!;
  assert.deepEqual(snapshot.groups[0].natures.map((nature) => nature.code), ['FIRST', 'ADUM_N']);
});

test('FINALIZED and active SUCCESS run gates reject provisional, failed, inactive, superseded, and corrupt lineage', () => {
  assert.equal(buildFinalizedMonthlySnapshot(period('2000', 2026, 7, { status: 'CALCULATED' })), null);
  for (const raw of [period('2000', 2026, 7, { runStatus: 'FAILED' }), period('2000', 2026, 7, { isActive: false }), period('2000', 2026, 7, { corruptRun: true })]) assert.throws(() => buildFinalizedMonthlySnapshot(raw), FluctuationIntegrityError);
  const superseded = period('2000', 2026, 7); superseded.activeCalculationRunId = superseded.activeRun!.id + 99;
  assert.throws(() => buildFinalizedMonthlySnapshot(superseded), /invalid active calculation-run lineage/);
});

test('E2-005 missing and non-FINALIZED comparison periods are UNAVAILABLE, while current provisional is rejected', async () => {
  const current = period('2000', 2026, 7); const missing = await createAnalysisService(repository([current]))(current.id, 'MOM');
  assert.equal(missing.kind === 'OK' && missing.status, 'UNAVAILABLE');
  if (missing.kind === 'OK' && missing.status === 'UNAVAILABLE') assert.deepEqual(missing.missingPeriods, [{ fiscalYear: 2026, fiscalPeriod: 6 }]);
  const calculated = period('2000', 2026, 6, { status: 'CALCULATED' }); assert.equal((await createAnalysisService(repository([current, calculated]))(current.id, 'MOM') as { status: string }).status, 'UNAVAILABLE');
  const provisional = period('2000', 2026, 7, { status: 'CALCULATED' }); assert.deepEqual(await createAnalysisService(repository([provisional]))(provisional.id, 'MOM'), { kind: 'INVALID_CURRENT', status: 'CALCULATED' });
});

test('E2-006 incomplete YTD is unavailable and reports every missing month', async () => {
  const current = period('2000', 2026, 3); const history = [current, period('2000', 2026, 1), period('2000', 2026, 2), period('2000', 2025, 1), period('2000', 2025, 3)];
  const result = await createAnalysisService(repository(history))(current.id, 'YTD');
  assert.equal(result.kind === 'OK' && result.status, 'UNAVAILABLE'); if (result.kind === 'OK' && result.status === 'UNAVAILABLE') assert.deepEqual(result.missingPeriods, [{ fiscalYear: 2025, fiscalPeriod: 2 }]);
});

test('missing item is zero, calculated residual has stable no-fake-COA identity, and output is deterministic', () => {
  const currentRaw = period('2000', 2026, 7); const priorRaw = period('2000', 2026, 6); const currentRun = currentRaw.activeRun!; const priorRun = priorRaw.activeRun!;
  const natureId = GROUPS.ADUM.id + 100; currentRun.actualLines.find((line) => line.natureId === natureId)!.finalAmount = d(0);
  currentRun.actualLines.push({ costGroupId: GROUPS.ADUM.id, natureId, coaId: null, lineType: 'RESIDUAL', finalAmount: d(10), ruleCode: 'RESIDUAL_RULE', coa: null });
  priorRun.actualLines.find((line) => line.natureId === natureId)!.coaId = 5555; priorRun.actualLines.find((line) => line.natureId === natureId)!.coa = { coaCode: '5555', coaDescription: 'Prior only' };
  const current = buildFinalizedMonthlySnapshot(currentRaw)!; const prior = buildFinalizedMonthlySnapshot(priorRaw)!;
  const first = compareSnapshots(current, prior); const second = compareSnapshots(current, prior); assert.deepEqual(first, second);
  const items = first.children![0].children![0].children!; const calculated = items.find((item) => item.nodeType === 'CALCULATED_ITEM')!;
  assert.equal(calculated.id, null); assert.equal(calculated.key, `calculated:${natureId}:RESIDUAL:RESIDUAL_RULE`); assert.equal(calculated.comparisonAmount, '0.00'); assert.equal(calculated.variancePercentStatus, 'NM');
});

test('available hierarchy and variance reconcile at every level; identical comparisons are zero and deterministic', () => {
  const snapshot = buildFinalizedMonthlySnapshot(period('7000', 2026, 7))!; const result = compareSnapshots(snapshot, snapshot);
  const sum = (nodes: typeof result[]) => nodes.reduce((total, node) => total.add(node.currentAmount), d(0));
  assert.equal(sum(result.children!).toFixed(2), result.currentAmount);
  for (const group of result.children!) { assert.equal(sum(group.children!).toFixed(2), group.currentAmount); for (const nature of group.children!) assert.equal(sum(nature.children!).toFixed(2), nature.currentAmount); }
  const walk = (node: typeof result) => { assert.equal(node.varianceAmount, '0.00'); assert.equal(node.variancePercent, '0.000000'); node.children?.forEach(walk); }; walk(result);
  assert.deepEqual(compareSnapshots(snapshot, snapshot), result);
});

test('available YTD response exposes every constituent period/run lineage', async () => {
  const periods = [2025, 2026].flatMap((year) => [1, 2, 3].map((month) => period('2000', year, month))); const current = periods.find((item) => item.fiscalYear === 2026 && item.fiscalPeriod === 3)!;
  const result = await createAnalysisService(repository(periods))(current.id, 'YTD'); assert.equal(result.kind === 'OK' && result.status, 'AVAILABLE');
  if (result.kind === 'OK' && result.status === 'AVAILABLE') { assert.equal(result.current.periods.length, 3); assert.equal(result.comparison.periods.length, 3); assert.equal(result.comparisonType, 'YTD'); assert.equal(result.hierarchy.length, 1); }
});
