import assert from 'node:assert/strict';
import test from 'node:test';
import { assertCurrentLineage } from './lineage';
import { lineageKey } from './context';
import type { Lineage } from '../analysis/types';

const si: Lineage = { periodId: 1, fiscalYear: 2026, fiscalPeriod: 7, runId: 10, ruleSetVersion: 'ENGINE1_2000_V2', uploadId: 1, basisCode: 'SI' };
const ghopo: Lineage = { periodId: 2, fiscalYear: 2026, fiscalPeriod: 7, runId: 8, ruleSetVersion: 'ENGINE1_7000_V1', uploadId: 2, basisCode: 'GHOPO' };
const deriv: Lineage = { ...ghopo, basisCode: 'DERIV' };

type Row = { id: number; companyCode: string; fiscalYear: number; fiscalPeriod: number; status: string; activeCalculationRunId: number; runId: number; uploadId: number; runStatus: string; isActive: boolean; ruleSetVersion: string };
const row2000: Row = { id: 1, companyCode: '2000', fiscalYear: 2026, fiscalPeriod: 7, status: 'FINALIZED', activeCalculationRunId: 10, runId: 10, uploadId: 1, runStatus: 'SUCCESS', isActive: true, ruleSetVersion: 'ENGINE1_2000_V2' };
const row7000: Row = { id: 2, companyCode: '7000', fiscalYear: 2026, fiscalPeriod: 7, status: 'FINALIZED', activeCalculationRunId: 8, runId: 8, uploadId: 2, runStatus: 'SUCCESS', isActive: true, ruleSetVersion: 'ENGINE1_7000_V1' };

function tx(rows: Row[]) {
  let calls = 0;
  return { $queryRaw: async () => ++calls === 1 ? rows.map(({ id }) => ({ id })) : rows };
}

test('commit-time lineage accepts exact SI and GHOPO+DERIV basis sets', async () => {
  await assertCurrentLineage(tx([row2000]) as never, 'MOM', [si], [], lineageKey('MOM', [si], []));
  await assertCurrentLineage(tx([row7000]) as never, 'MOM', [ghopo, deriv], [], lineageKey('MOM', [ghopo, deriv], []));
});

test('missing, duplicate, or wrong Company 7000 basis lineage is stale', async () => {
  await assert.rejects(assertCurrentLineage(tx([row7000]) as never, 'MOM', [ghopo], [], lineageKey('MOM', [ghopo], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([row7000]) as never, 'MOM', [ghopo, ghopo], [], lineageKey('MOM', [ghopo, ghopo], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([row7000]) as never, 'MOM', [{ ...ghopo, basisCode: 'SI' }], [], lineageKey('MOM', [{ ...ghopo, basisCode: 'SI' }], [])), /stale/);
});

test('reopen, run replacement, upload replacement, and stale digest are rejected', async () => {
  await assert.rejects(assertCurrentLineage(tx([{ ...row2000, status: 'CALCULATED' }]) as never, 'MOM', [si], [], lineageKey('MOM', [si], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([{ ...row2000, activeCalculationRunId: 11, runId: 11 }]) as never, 'MOM', [si], [], lineageKey('MOM', [si], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([{ ...row2000, uploadId: 9 }]) as never, 'MOM', [si], [], lineageKey('MOM', [si], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([{ ...row2000, ruleSetVersion: 'ENGINE1_2000_V3' }]) as never, 'MOM', [si], [], lineageKey('MOM', [si], [])), /stale/);
  await assert.rejects(assertCurrentLineage(tx([row2000]) as never, 'MOM', [si], [], 'old-lineage'), /stale/);
});
