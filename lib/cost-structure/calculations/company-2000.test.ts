import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { calculateCompany2000 } from './company-2000';
import type { ResolvedSourceLine } from './types';

const d = (value: string | number) => new Prisma.Decimal(value);
const line = (overrides: Partial<ResolvedSourceLine> = {}): ResolvedSourceLine => ({ sourceRowId: 1, uploadId: 10, uploadVersion: 2, logicalSourceCode: 'CC_ADUM', sourceRowNumber: 7, coaId: 9, coaCode: '001234', amount: d('10.10'), disposition: 'MAPPED', mappingId: 12, mappingAction: 'INCLUDE', costGroupId: 20, groupCode: 'ADUM', natureId: 30, natureCode: 'STAFF', targetActive: true, natureCalculationType: 'MAPPED', applicableMappingCount: 1, ...overrides });

test('E1-2000 scope, Nature roll-up, exact controls and leading-zero lineage', () => {
  const result = calculateCompany2000({ sourceLines: [line(), line({ sourceRowId: 2, amount: d('0.20') }), line({ sourceRowId: 3, groupCode: 'PASAR', costGroupId: 21, natureId: 31, natureCode: 'SELLING', logicalSourceCode: 'CC_PASAR', amount: d('-2.30') })] });
  assert.deepEqual(result.natureTotals.map((item) => [item.groupCode, item.amount.toString()]), [['ADUM', '10.3'], ['PASAR', '-2.3']]);
  assert.equal(result.groupTotals.ADUM.toString(), '10.3'); assert.equal(result.groupTotals.PASAR.toString(), '-2.3'); assert.equal(result.companyTotal.toString(), '8');
  assert.ok(result.controls.every((control) => control.difference.isZero()));
  assert.deepEqual(new Set(result.natureTotals.map((item) => item.groupCode)), new Set(['ADUM', 'PASAR']));
  assert.equal(result.actualLines[0].sourceReference.coaCode, '001234');
});

test('INCLUDE and RECLASS contribute; EXCLUDE, control and support do not', () => {
  const result = calculateCompany2000({ sourceLines: [line(), line({ sourceRowId: 2, disposition: 'RECLASSIFIED', mappingAction: 'RECLASS', amount: d(5) }), line({ sourceRowId: 3, disposition: 'EXCLUDED', mappingAction: 'EXCLUDE', amount: d(999) }), line({ sourceRowId: 4, disposition: 'CONTROL_ROW', amount: d(999) }), line({ sourceRowId: 5, disposition: 'SUPPORT_SOURCE', amount: d(999) })] });
  assert.equal(result.companyTotal.toString(), '15.1'); assert.equal(result.actualLines.length, 2); assert.equal(result.actualLines[1].sourceReference.mappingAction, 'RECLASS');
});

test('unmapped non-zero, ambiguous mapping, inactive and non-MAPPED targets block', () => {
  assert.throws(() => calculateCompany2000({ sourceLines: [line({ disposition: 'UNMAPPED', applicableMappingCount: 0 })] }), /no effective mapping/);
  assert.throws(() => calculateCompany2000({ sourceLines: [line({ applicableMappingCount: 2 })] }), /ambiguous/);
  assert.throws(() => calculateCompany2000({ sourceLines: [line({ targetActive: false })] }), /inactive/);
  for (const type of ['FORMULA', 'RESIDUAL']) assert.throws(() => calculateCompany2000({ sourceLines: [line({ natureCalculationType: type })] }), /only MAPPED/);
});

test('zero unmapped is harmless and adjustment is exact', () => {
  const result = calculateCompany2000({ sourceLines: [line({ disposition: 'UNMAPPED', applicableMappingCount: 0, amount: d(0) })], adjustments: [{ adjustmentId: 8, costGroupId: 20, groupCode: 'ADUM', natureId: 30, natureCode: 'STAFF', coaId: null, amount: d('-0.01'), reason: 'Correction', reference: 'REF', targetActive: true, natureCalculationType: 'MAPPED' }] });
  assert.equal(result.actualLines.length, 1); assert.equal(result.actualLines[0].lineType, 'ADJUSTMENT'); assert.equal(result.companyTotal.toString(), '-0.01');
});

test('CC_PROD and Derivatif injections have zero effect and rerun is deterministic', () => {
  const input = [line()]; const base = calculateCompany2000({ sourceLines: input });
  for (const source of ['CC_PROD', 'DERIVATIF', 'CC_DERIVATIF', 'CC_DRV']) {
    const injected = calculateCompany2000({ sourceLines: [...input, line({ sourceRowId: 99, logicalSourceCode: source, amount: d('999999999999.99') })] });
    assert.equal(injected.companyTotal.toString(), base.companyTotal.toString());
  }
  assert.deepEqual(calculateCompany2000({ sourceLines: input }), calculateCompany2000({ sourceLines: input }));
});

test('Company 2000 authoritative golden arithmetic contract', () => {
  const result = calculateCompany2000({ sourceLines: [line({ amount: d('107796550061') }), line({ sourceRowId: 2, logicalSourceCode: 'CC_PASAR', groupCode: 'PASAR', costGroupId: 21, natureId: 31, natureCode: 'SELLING', amount: d('17900551142') })] });
  assert.equal(result.groupTotals.PASAR.toFixed(0), '17900551142');
  assert.equal(result.groupTotals.ADUM.toFixed(0), '107796550061');
  assert.equal(result.companyTotal.toFixed(0), '125697101203');
});

