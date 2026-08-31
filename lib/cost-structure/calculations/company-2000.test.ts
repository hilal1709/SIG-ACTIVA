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

test('source-specific 676 mapping keeps ADUM tax while PASAR rolls into UUA', () => {
  const result = calculateCompany2000({ sourceLines: [
    line({ coaCode:'67630009', groupCode:'ADUM', natureCode:'N09', amount:d(10) }),
    line({ sourceRowId:2, coaCode:'67630009', logicalSourceCode:'CC_PASAR', groupCode:'PASAR', costGroupId:21, natureId:31, natureCode:'N07', amount:d(20) }),
  ]});
  assert.deepEqual(result.natureTotals.map((item)=>[item.groupCode,item.natureCode,item.amount.toString()]),[['ADUM','N09','10'],['PASAR','N07','20']]);
});

test('unrecognized sources have zero effect and rerun is deterministic', () => {
  const input = [line()]; const base = calculateCompany2000({ sourceLines: input });
  for (const source of ['CC_PROD', 'DERIVATIF', 'CC_DERIVATIF']) {
    const injected = calculateCompany2000({ sourceLines: [...input, line({ sourceRowId: 99, logicalSourceCode: source, amount: d('999999999999.99') })] });
    assert.equal(injected.companyTotal.toString(), base.companyTotal.toString());
  }
  assert.deepEqual(calculateCompany2000({ sourceLines: input }), calculateCompany2000({ sourceLines: input }));
});

test('Company 2000 authoritative golden arithmetic contract', () => {
  let id = 0;
  const nature = (groupCode: 'ADUM'|'PASAR', natureCode: string, amount: string, logicalSourceCode = groupCode === 'ADUM' ? 'CC_ADUM' : 'CC_PASAR', ruleCode?: string) => line({ sourceRowId: ++id, logicalSourceCode, groupCode, costGroupId: groupCode === 'ADUM' ? 20 : 21, natureId: ++id + 100, natureCode, amount: d(amount), ruleCode });
  const result = calculateCompany2000({ derivativeControlTotal:d('1488906545'), sourceLines: [
    nature('ADUM','N01','180971720'), nature('ADUM','N02','37590056'), nature('ADUM','N02','-388','AUDIT_RINCIAN','RINCIAN_DELTA_ADUM'), nature('ADUM','N03','700733597'),
    nature('ADUM','N04','49865167866'), nature('ADUM','N04','40572754'), nature('ADUM','N04','7035484'), nature('ADUM','N05','1998787267'), nature('ADUM','N06','5514747437'), nature('ADUM','N07','44532279743'), nature('ADUM','N08','954509200'), nature('ADUM','N09','4011763175'),
    nature('PASAR','N02','117483235'), nature('PASAR','N02','-12540370','AUDIT_CC_DRV','CC_DRV_DERIVATIVE_OFFSET'), nature('PASAR','N03','220626'),
    nature('PASAR','N04','8051373527'), nature('PASAR','N04','9500000'), nature('PASAR','N04','-1115041922','AUDIT_CC_DRV','CC_DRV_DERIVATIVE_OFFSET'),
    nature('PASAR','N06','1528950213'), nature('PASAR','N06','16270603'), nature('PASAR','N07','1938877955'), nature('PASAR','N07','65679295'), nature('PASAR','N07','-142428608','AUDIT_CC_DRV','CC_DRV_DERIVATIVE_OFFSET'),
    nature('PASAR','N08','6197966291'), nature('PASAR','N08','-168549750','AUDIT_CC_DRV','CC_DRV_DERIVATIVE_OFFSET'),
  ] });
  assert.equal(result.groupTotals.ADUM.toFixed(0), '107844157911');
  assert.equal(result.groupTotals.PASAR.toFixed(0), '16487761095');
  assert.equal(result.companyTotal.toFixed(0), '124331919006');
  assert.equal(result.controls.find((control)=>control.resultCode==='CC_DRV_DETAIL_RECONCILIATION')?.amount.toFixed(0),'1488906545');
  const total = (group: string, code: string) => result.natureTotals.filter((item) => item.groupCode === group && item.natureCode === code).reduce((sum,item)=>sum.add(item.amount),d(0)).toFixed(0);
  assert.equal(total('ADUM','N02'),'37589668'); assert.equal(total('ADUM','N04'),'49912776104');
  assert.equal(total('PASAR','N02'),'104942865'); assert.equal(total('PASAR','N04'),'6945831605'); assert.equal(total('PASAR','N06'),'1545220816'); assert.equal(total('PASAR','N07'),'1862128642'); assert.equal(total('PASAR','N08'),'6029416541');
  assert.ok(result.controls.filter((control)=>control.resultCode.endsWith('RECONCILIATION')).every((control)=>control.difference.isZero()));
});
