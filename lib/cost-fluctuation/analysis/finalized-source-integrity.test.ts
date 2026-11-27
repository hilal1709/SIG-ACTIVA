import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { buildFinalizedMonthlySnapshot, FluctuationIntegrityError } from './snapshot';
import type { PersistedLine, PersistedPeriod, PersistedResult, PersistedSourceRow } from './types';

const d = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const group = (code: string, name: string, displayOrder: number) => ({ code, name, displayOrder });
const nature = (code: string, name: string, displayOrder: number) => ({ code, name, displayOrder });
const source = (uploadId: number, logicalSourceCode: string, rows: Array<[string, string]>): PersistedSourceRow[] => rows.map(([label, amount], index) => ({
  id: index + 1,
  uploadId,
  logicalSourceCode,
  sourceRowNumber: index + 1,
  rawDataJson: { COLUMN_1: label, COLUMN_2: amount },
}));

function company2000(): PersistedPeriod {
  const uploadId = 200;
  const adum = group('ADUM', 'ADUM', 1); const pasar = group('PASAR', 'PASAR', 2);
  const results: PersistedResult[] = [
    { costGroupId: 1, natureId: null, resultCode: 'TOTAL_ADUM', resultType: 'TOTAL', amount: d(10), costGroup: adum, nature: null },
    { costGroupId: 2, natureId: null, resultCode: 'TOTAL_PASAR', resultType: 'TOTAL', amount: d(100), costGroup: pasar, nature: null },
    { costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL', amount: d(110), costGroup: null, nature: null },
    { costGroupId: 1, natureId: 11, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(10), costGroup: adum, nature: nature('N01', 'Bahan Penolong', 1) },
    { costGroupId: 2, natureId: 27, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(30), costGroup: pasar, nature: nature('N07', 'Umum & Adm. Kantor', 7) },
    { costGroupId: 2, natureId: 28, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(70), costGroup: pasar, nature: nature('N08', 'Perniagaan', 8) },
  ];
  const actualLines: PersistedLine[] = [
    { costGroupId: 1, natureId: 11, coaId: 101, lineType: 'COA', finalAmount: d(10), ruleCode: null, coa: { coaCode: '101', coaDescription: 'ADUM' } },
    { costGroupId: 2, natureId: 27, coaId: 201, lineType: 'COA', finalAmount: d(30), ruleCode: null, coa: { coaCode: '201', coaDescription: 'PASAR UUA' } },
    { costGroupId: 2, natureId: 28, coaId: 202, lineType: 'COA', finalAmount: d(70), ruleCode: null, coa: { coaCode: '202', coaDescription: 'PASAR trade' } },
  ];
  const sourceRows = source(uploadId, 'AUDIT_SI', [
    ['UMUM & ADMINISTRASI', ''], ['Bahan Penolong', '0.01'], ['Total Adum', '0.01'],
    ['PEMASARAN', ''], ['Urusan Umum dan Administrasi Kantor', '0.04'], ['Perniagaan', '0.06'], ['Total Perniagaan', '0.10'],
  ]);
  return { id: 20, companyId: 2, companyCode: '2000', fiscalYear: 2026, fiscalPeriod: 7, status: 'FINALIZED', activeCalculationRunId: 2000, activeRun: { id: 2000, periodId: 20, uploadId, uploadIsActiveVersion: true, status: 'SUCCESS', isActive: true, ruleSetVersion: 'ENGINE1_2000_V2', results, actualLines, sourceRows } };
}

function company7000WithoutDeriv(): PersistedPeriod {
  const uploadId = 700;
  const hpp = group('HPP', 'HPP', 1); const adum = group('ADUM', 'ADUM', 2); const pasar = group('PASAR', 'PASAR', 3);
  const results: PersistedResult[] = [
    { costGroupId: 3, natureId: null, resultCode: 'TOTAL_HPP', resultType: 'TOTAL', amount: d(100), costGroup: hpp, nature: null },
    { costGroupId: 4, natureId: null, resultCode: 'TOTAL_ADUM', resultType: 'TOTAL', amount: d(10), costGroup: adum, nature: null },
    { costGroupId: 5, natureId: null, resultCode: 'TOTAL_PASAR', resultType: 'TOTAL', amount: d(90), costGroup: pasar, nature: null },
    { costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL', amount: d(200), costGroup: null, nature: null },
    { costGroupId: 3, natureId: 34, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(0), costGroup: hpp, nature: nature('H04', 'Batubara', 4) },
    { costGroupId: 3, natureId: 36, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(100), costGroup: hpp, nature: nature('H06', 'Bahan Bakar lainnya', 6) },
    { costGroupId: 4, natureId: 41, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(10), costGroup: adum, nature: nature('N01', 'Bahan Penolong', 1) },
    { costGroupId: 5, natureId: 58, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(20), costGroup: pasar, nature: nature('N08', 'Perniagaan', 8) },
    { costGroupId: 5, natureId: 59, resultCode: 'NATURE_TOTAL', resultType: 'NATURE', amount: d(70), costGroup: pasar, nature: nature('OA', 'OA', 10) },
  ];
  const actualLines: PersistedLine[] = [
    { costGroupId: 3, natureId: 36, coaId: null, lineType: 'FORMULA', finalAmount: d(100), ruleCode: 'COAL_RECLASS', coa: null },
    { costGroupId: 4, natureId: 41, coaId: 401, lineType: 'COA', finalAmount: d(10), ruleCode: null, coa: { coaCode: '401', coaDescription: 'ADUM' } },
    { costGroupId: 5, natureId: 58, coaId: 501, lineType: 'COA', finalAmount: d(20), ruleCode: null, coa: { coaCode: '501', coaDescription: 'PASAR' } },
    { costGroupId: 5, natureId: 59, coaId: null, lineType: 'FORMULA', finalAmount: d(70), ruleCode: 'OA_7000_EXISTING', coa: null },
  ];
  const sourceRows = source(uploadId, 'AUDIT_GHOPO', [
    ['Beban Pokok Penjualan', ''], ['Batu bara', '0.08'], ['Bahan Bakar lainnya', '0.02'], ['Total HPP', '0.10'],
    ['UMUM & ADMINISTRASI', ''], ['Bahan Penolong', '0.01'], ['Total Adum', '0.01'],
    ['PEMASARAN', ''], ['Perniagaan', '0.03'], ['Total Perniagaan', '0.03'], ['OA', '0.06'],
  ]);
  return { id: 70, companyId: 7, companyCode: '7000', fiscalYear: 2025, fiscalPeriod: 1, status: 'FINALIZED', activeCalculationRunId: 7000, activeRun: { id: 7000, periodId: 70, uploadId, uploadIsActiveVersion: true, status: 'SUCCESS', isActive: true, ruleSetVersion: 'ENGINE1_7000_V1', results, actualLines, sourceRows } };
}

test('Company 2000 analysis accepts finalized Engine 1 redistribution while source audit remains internally reconciled', () => {
  const snapshot = buildFinalizedMonthlySnapshot(company2000())!;
  const pasar = snapshot.bases[0].groups.find((candidate) => candidate.code === 'PASAR')!;
  assert.equal(pasar.natures.find((candidate) => candidate.code === 'N07')!.amount.toFixed(2), '30.00');
  assert.equal(pasar.natures.find((candidate) => candidate.code === 'N08')!.amount.toFixed(2), '70.00');
  assert.equal(snapshot.amount.toFixed(2), '110.00');
});

test('primary audit still fails closed when its own persisted leaf sum no longer reconciles to the control total', () => {
  const period = company2000();
  const total = period.activeRun!.sourceRows.find((row) => (row.rawDataJson as Record<string, string>).COLUMN_1 === 'Total Perniagaan')!;
  (total.rawDataJson as Record<string, string>).COLUMN_2 = '0.11';
  assert.throws(() => buildFinalizedMonthlySnapshot(period), FluctuationIntegrityError);
});

test('Company 7000 accepts formula redistribution and represents an absent historical DERIV source as zero without fabricating lineage', () => {
  const snapshot = buildFinalizedMonthlySnapshot(company7000WithoutDeriv())!;
  assert.deepEqual(snapshot.bases.map((basis) => [basis.code, basis.amount.toFixed(2)]), [['GHOPO', '200.00'], ['DERIV', '0.00']]);
  assert.deepEqual(snapshot.lineage.map((line) => line.basisCode), ['GHOPO']);
  assert.equal(snapshot.bases[0].groups.find((candidate) => candidate.code === 'HPP')!.natures.find((candidate) => candidate.code === 'H04')!.amount.toFixed(2), '0.00');
});
