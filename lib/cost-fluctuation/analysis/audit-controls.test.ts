import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { buildFinalizedMonthlySnapshot, FluctuationIntegrityError } from './snapshot';
import type { PersistedPeriod, PersistedSourceRow } from './types';

const d = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);

function sourceRows(uploadId: number): PersistedSourceRow[] {
  const data: Array<[string, string]> = [
    ['UMUM & ADMINISTRASI', ''],
    ['Ctrl', '999'],
    ['Bahan Penolong', '0.01'],
    ['Total Adum', '0.01'],
    ['PEMASARAN', ''],
    ['Bahan Bakar', '0.02'],
    ['Total Perniagaan', '0.02'],
    ['OPEX - Recap', '0.03'],
    ['OPEX - Rincian', '0.031'],
    ['Gap', '-0.001'],
    ['Derivatif', '0.001'],
    ['Gap', '-1.862645149230957e-9'],
  ];
  return data.map(([label, amount], index) => ({
    id: index + 1,
    uploadId,
    logicalSourceCode: 'AUDIT_SI',
    sourceRowNumber: index + 1,
    rawDataJson: { COLUMN_1: label, COLUMN_2: amount },
  }));
}

function period(): PersistedPeriod {
  const uploadId = 77;
  return {
    id: 7,
    companyId: 2,
    companyCode: '2000',
    fiscalYear: 2026,
    fiscalPeriod: 7,
    status: 'FINALIZED',
    activeCalculationRunId: 70,
    activeRun: {
      id: 70,
      periodId: 7,
      uploadId,
      status: 'SUCCESS',
      isActive: true,
      ruleSetVersion: 'ENGINE1_2000_V2',
      results: [
        { costGroupId: 10, natureId: null, resultCode: 'TOTAL_ADUM', resultType: 'TOTAL', amount: d(10), costGroup: { code: 'ADUM', name: 'ADUM', displayOrder: 1 }, nature: null },
        { costGroupId: 10, natureId: 101, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(10), costGroup: { code: 'ADUM', name: 'ADUM', displayOrder: 1 }, nature: { code: 'N01', name: 'Bahan Penolong', displayOrder: 1 } },
        { costGroupId: 20, natureId: null, resultCode: 'TOTAL_PASAR', resultType: 'TOTAL', amount: d(20), costGroup: { code: 'PASAR', name: 'PASAR', displayOrder: 2 }, nature: null },
        { costGroupId: 20, natureId: 201, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(20), costGroup: { code: 'PASAR', name: 'PASAR', displayOrder: 2 }, nature: { code: 'N02', name: 'Bahan Bakar', displayOrder: 1 } },
        { costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL', amount: d(30), costGroup: null, nature: null },
      ],
      actualLines: [
        { costGroupId: 10, natureId: 101, coaId: 1001, lineType: 'COA', finalAmount: d(10), ruleCode: null, coa: { coaCode: '1001', coaDescription: 'ADUM' } },
        { costGroupId: 20, natureId: 201, coaId: 2001, lineType: 'COA', finalAmount: d(20), ruleCode: null, coa: { coaCode: '2001', coaDescription: 'PASAR' } },
      ],
      sourceRows: sourceRows(uploadId),
    },
  };
}

test('known non-Nature SI footer controls are ignored without weakening fail-closed parsing', () => {
  const valid = period();
  assert.equal(buildFinalizedMonthlySnapshot(valid)!.amount.toFixed(2), '30.00');

  const unknown = period();
  unknown.activeRun!.sourceRows.push({
    id: 999,
    uploadId: unknown.activeRun!.uploadId,
    logicalSourceCode: 'AUDIT_SI',
    sourceRowNumber: 999,
    rawDataJson: { COLUMN_1: 'Mystery Nature', COLUMN_2: '0.001' },
  });
  assert.throws(() => buildFinalizedMonthlySnapshot(unknown), FluctuationIntegrityError);
});
