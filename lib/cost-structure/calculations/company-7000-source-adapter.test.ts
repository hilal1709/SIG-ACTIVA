import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calculateCompany7000 } from './company-7000';
import { buildCompany7000Input, deriveCompany7000TotalHpp, type AdapterMapping, type AdapterSourceRow } from './company-7000-source-adapter';
import type { Company7000NatureTarget } from './types';

const D = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
const tbRow = (id: number, coaCode: string, amount: string): AdapterSourceRow => ({ id, uploadId: 1, uploadVersion: 1, logicalSourceCode: 'TB', sourceRowNumber: id, coaId: id, coaCode, description: coaCode === '51300003' ? 'COST OF REVENUE-MORTAR' : 'TB', amount: D(amount), rawData: {} });

test('Company 7000 TB selector derives verified Total HPP without an Excel row dependency', () => {
  const result = deriveCompany7000TotalHpp([tbRow(8, '51100001', '413169722810'), tbRow(99, '51300003', '4571043173'), tbRow(2, '40000001', '123')]);
  assert.equal(result.accountGroup5Total.toFixed(2), '417740765983.00');
  assert.equal(result.cogsMortar.toFixed(2), '4571043173.00');
  assert.equal(result.totalHpp.toFixed(2), '413169722810.00');
  assert.deepEqual(result.mortarRows.map((item) => item.id), [99]);
});

test('Company 7000 TB selector blocks missing or ambiguous COGS Mortar', () => {
  assert.throws(() => deriveCompany7000TotalHpp([tbRow(1, '51100001', '1')]), /exactly one/);
  assert.throws(() => deriveCompany7000TotalHpp([tbRow(1, '51300003', '1'), tbRow(2, '51300003', '2')]), /exactly one/);
});

const nature = (natureId: number, groupCode: 'HPP' | 'ADUM' | 'PASAR', natureCode: string, calculationType: 'MAPPED' | 'FORMULA' | 'RESIDUAL' = 'MAPPED', ruleCode: string | null = null): Company7000NatureTarget => ({
  costGroupId: groupCode === 'HPP' ? 10 : groupCode === 'ADUM' ? 20 : 30,
  natureId, groupCode, natureCode, calculationType, ruleCode, active: true,
});
const natures: Company7000NatureTarget[] = [
  nature(1, 'HPP', 'H01'), nature(6, 'HPP', 'H06'), nature(7, 'HPP', 'H07'), nature(8, 'HPP', 'H08'), nature(14, 'HPP', 'H14'),
  nature(4, 'HPP', 'H04', 'FORMULA', 'COAL_7000_EXISTING'), nature(5, 'HPP', 'H05', 'FORMULA', 'COAL_INBOUND_7000_EXISTING'),
  nature(16, 'HPP', 'H16', 'RESIDUAL', 'HPP_INVENTORY_DIFF_7000'),
  nature(101, 'ADUM', 'N01'), nature(201, 'PASAR', 'N01'), nature(210, 'PASAR', 'OA', 'FORMULA', 'OA_7000_EXISTING'),
];
let nextId = 1000;
const row = (source: string, coaCode: string | null, amount: string | null, sourceRowNumber: number, rawData: Record<string, unknown> = {}, coaId?: number | null): AdapterSourceRow => ({
  id: nextId++, uploadId: 77, uploadVersion: 1, logicalSourceCode: source, sourceRowNumber,
  coaId: coaId === undefined ? (coaCode && /^\d{8}$/.test(coaCode) ? Number(coaCode.slice(-5)) + 100 : null) : coaId,
  coaCode, description: coaCode, amount: amount === null ? null : D(amount), rawData,
});
const mappings: AdapterMapping[] = [];
const addMap = (source: string, sourceRow: AdapterSourceRow, natureId: number, action: 'INCLUDE' | 'EXCLUDE' | 'RECLASS' = 'INCLUDE') => {
  const target = natures.find((item) => item.natureId === natureId)!;
  mappings.push({ id: mappings.length + 1, sourceLogicalCode: source, coaId: sourceRow.coaId!, mappingAction: action,
    costGroupId: action === 'EXCLUDE' ? null : target.costGroupId, natureId: action === 'EXCLUDE' ? null : target.natureId,
    groupCode: action === 'EXCLUDE' ? null : target.groupCode, natureCode: action === 'EXCLUDE' ? null : target.natureCode,
    targetActive: true, natureCalculationType: action === 'EXCLUDE' ? null : target.calculationType });
};

function fixture() {
  nextId = 1000; mappings.length = 0;
  const rows: AdapterSourceRow[] = [];
  rows.push(row('TB', '51100001', '1000', 3), row('TB', '51300003', '100', 4));
  const tbFuel = row('TB', '62100001', '500', 5); const tbElec = row('TB', '62200001', '100', 6); const tbLaborA = row('TB', '62300001', '80', 7); const tbLaborB = row('TB', '62300002', '20', 8); const tbSolar = row('TB', '62140001', '10', 9); rows.push(tbFuel, tbElec, tbLaborA, tbLaborB, tbSolar);
  addMap('CC_PROD', tbFuel, 6); addMap('CC_PROD', tbElec, 7); addMap('CC_PROD', tbLaborA, 8); addMap('CC_PROD', tbLaborB, 8); addMap('CC_PROD', tbSolar, 6);
  rows.push(row('CC_ADUM', '61000001', '0', 10, {}, null));
  const pasar6811 = row('CC_PASAR', '68110001', '10', 11); const pasar6817 = row('CC_PASAR', '68170002', '20', 12); rows.push(pasar6811, pasar6817); addMap('CC_PASAR', pasar6811, 201, 'EXCLUDE'); addMap('CC_PASAR', pasar6817, 201, 'EXCLUDE');
  const whFuel = row('CC_WHRPG', '62110001', '10', 13); const whLabor = row('CC_WHRPG', '62310001', '30', 14); const whInternal = row('CC_WHRPG', '97110001', '5', 15); rows.push(whFuel, whLabor, whInternal); addMap('CC_WHRPG', whFuel, 6); addMap('CC_WHRPG', whLabor, 8); addMap('CC_WHRPG', whInternal, 8, 'EXCLUDE');
  rows.push(row('COAL', null, null, 10, { COLUMN_8: '100.111', COLUMN_9: '30.111' }, null), row('COAL', null, null, 18, { COLUMN_8: '0', COLUMN_9: '0' }, null));
  rows.push(
    row('OA_STAT', null, null, 20, { ROLE_GL: '68110001', ROLE: 'SUMMARY', ROLE_AMOUNT: '1' }, null),
    row('OA_STAT', null, null, 21, { ROLE_GL: '68140005', ROLE: 'SUMMARY', ROLE_AMOUNT: '2' }, null),
    row('OA_STAT', null, null, 22, { ROLE_GL: '68140005', ROLE: 'TRANSACTION', ROLE_AMOUNT: '3', COMPANY_CODE: '7000', POSTING_PERIOD: '8' }, null),
    row('OA_STAT', null, null, 23, { ROLE_GL: '68140006', ROLE: 'SUMMARY', ROLE_AMOUNT: '4' }, null),
    row('OA_STAT', null, null, 24, { ROLE_GL: '68140006', ROLE: 'TRANSACTION', ROLE_AMOUNT: '5', COMPANY_CODE: '7000', POSTING_PERIOD: '8' }, null),
    row('OA_STAT', null, null, 25, { ROLE_GL: '68140005', ROLE: 'DERIVATIVE', ROLE_AMOUNT: '6' }, null),
  );
  rows.push(row('SOLAR_PP_ORDER', null, null, 30, { MATERIAL: '112-200001', PLANT: '7702', 'COST ELEMENT TEXT': 'Consumption Production CKM3n', 'VALUE IN OBJ CRCY': '7' }, null));
  for (let sourceRowNumber = 63; sourceRowNumber <= 69; sourceRowNumber++) rows.push(row('CLINKER_PURCHASE', null, null, sourceRowNumber, { COLUMN_6: '0' }, null));
  return { companyCode: '7000' as const, fiscalPeriod: 8, rows, mappings, natures };
}

test('adapter applies WHRPG and coal corrections once per Nature and preserves current-period OA lineage', () => {
  const input = buildCompany7000Input(fixture());
  const whLaborLines = input.sourceLines.filter((line) => line.ruleCode === 'WHRPG_RECLASS_7000' && line.natureCode === 'H08');
  assert.equal(whLaborLines.length, 1);
  assert.equal(whLaborLines[0].amount.toFixed(2), '-30.00');
  assert.equal(input.sourceLines.filter((line) => line.ruleCode === 'COAL_ENERGY_SPLIT_7000').length, 1);
  assert.equal(input.sourceLines.find((line) => line.ruleCode === 'COAL_ENERGY_SPLIT_7000')!.amount.toFixed(2), '-130.22');
  assert.ok(input.formulaDependencies.oaComponents.some((item) => item.logicalSourceCode === 'CC_PASAR'));
  assert.ok(input.formulaDependencies.oaComponents.some((item) => item.logicalSourceCode === 'OA_STAT'));
  assert.equal(input.sourceLines.filter((line) => line.logicalSourceCode === 'CC_ADUM').length, 0, 'zero unmapped source remains non-blocking');
  assert.doesNotThrow(() => calculateCompany7000(input));
});

test('adapter blocks OA transaction rows from the wrong fiscal period', () => {
  const value = fixture(); value.fiscalPeriod = 7;
  assert.throws(() => buildCompany7000Input(value), /TRANSACTION source component is missing/);
});
