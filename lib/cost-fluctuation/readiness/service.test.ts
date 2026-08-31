import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveReadinessDependencies } from './period-dependencies';
import { createReadinessService } from './service';
import type { ReadinessPeriod } from './types';

const period = (id: number, companyId: number, companyCode: string, fiscalYear: number, fiscalPeriod: number, status = 'FINALIZED'): ReadinessPeriod => ({
  id, companyId, companyCode, fiscalYear, fiscalPeriod, status, activeCalculationRunId: status === 'FINALIZED' ? id + 100 : null,
  activeRun: status === 'FINALIZED' ? { id: id + 100, periodId: id, status: 'SUCCESS', isActive: true, ruleSetVersion: companyCode === '2000' ? 'ENGINE1_2000_V2' : 'ENGINE1_7000_V1' } : null,
});

test('dependency resolver shares Engine 2 Jan boundary, MoM, YoY, and YTD semantics', () => {
  assert.deepEqual(resolveReadinessDependencies({ fiscalYear: 2026, fiscalPeriod: 1 }).mom, [{ fiscalYear: 2025, fiscalPeriod: 12 }]);
  const jul = resolveReadinessDependencies({ fiscalYear: 2026, fiscalPeriod: 7 });
  assert.deepEqual(jul.mom, [{ fiscalYear: 2026, fiscalPeriod: 6 }]);
  assert.deepEqual(jul.yoy, [{ fiscalYear: 2025, fiscalPeriod: 7 }]);
  assert.equal(jul.ytd.current.length, 7);
  assert.equal(jul.ytd.comparison.length, 7);
});

test('missing periods remain missing and incomplete YTD is unavailable, never zero', async () => {
  const service = createReadinessService({ findAll: async () => [period(1, 1, '2000', 2026, 7)] });
  const [jul] = (await service()).periods;
  assert.equal(jul.mom.readiness, 'MISSING');
  assert.deepEqual(jul.mom.missing.map(({ fiscalYear, fiscalPeriod }) => ({ fiscalYear, fiscalPeriod })), [{ fiscalYear: 2026, fiscalPeriod: 6 }]);
  assert.equal(jul.yoy.readiness, 'MISSING');
  assert.equal(jul.ytd.readiness, 'MISSING');
  assert.equal(jul.ytd.required.length, 14);
  assert.equal(jul.ytd.available.length, 1);
  assert.equal(jul.ytd.missing.length, 13);
  assert.ok(jul.ytd.missing.every((item) => item.periodId === null && item.status === null));
});

test('finalized, non-finalized, and invalid authoritative runs are distinguished', async () => {
  const current = period(10, 1, '2000', 2026, 7);
  const june = period(9, 1, '2000', 2026, 6, 'CALCULATED');
  const prior = period(8, 1, '2000', 2025, 7);
  prior.activeRun = { ...prior.activeRun!, status: 'FAILED' };
  const jul = (await createReadinessService({ findAll: async () => [current, june, prior] })()).periods[0];
  assert.equal(jul.currentReadiness, 'AVAILABLE');
  assert.equal(jul.mom.readiness, 'NOT_FINALIZED');
  assert.equal(jul.yoy.readiness, 'INVALID_ACTIVE_RUN');
});

test('company 2000 and 7000 readiness state is independent', async () => {
  const rows = [period(1, 1, '2000', 2026, 7), period(2, 2, '7000', 2026, 7), period(3, 1, '2000', 2026, 6)];
  const result = await createReadinessService({ findAll: async () => rows })();
  const c2000 = result.periods.find((item) => item.companyCode === '2000' && item.fiscalPeriod === 7)!;
  const c7000 = result.periods.find((item) => item.companyCode === '7000')!;
  assert.equal(c2000.mom.readiness, 'AVAILABLE');
  assert.equal(c7000.mom.readiness, 'MISSING');
});
