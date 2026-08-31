import test from 'node:test';
import assert from 'node:assert/strict';
import { Prisma } from '@prisma/client';
import { parseCompany2000Derivative, parseCompany2000Rincian, sumSupportByCoa } from './company-2000-si-adapter';

const row = (id: number, source: string, values: Record<string, unknown>) => ({ id, logicalSourceCode: source, sourceRowNumber: id, rawData: values });

test('Rincian derives a dynamic COA-level ADUM correction from persisted cells', () => {
  const parsed = parseCompany2000Rincian([
    row(1,'AUDIT_RINCIAN',{COLUMN_2:'G/L acc',COLUMN_5:'ADM',COLUMN_6:'PASAR'}),
    row(2,'AUDIT_RINCIAN',{COLUMN_2:'62140001 DIESEL OIL CONSUM',COLUMN_5:'11043733',COLUMN_6:'0'}),
  ]);
  assert.equal(sumSupportByCoa(parsed.ADUM).get('62140001')?.sub('11044121').toString(), '-388');
});

test('CC_DRV uses eight-digit details only, ignores subtotals, and reconciles Decimal detail to Grand Total', () => {
  const parsed = parseCompany2000Derivative([
    row(1,'AUDIT_CC_DRV',{COLUMN_29:'621',COLUMN_30:'999999999'}),
    row(2,'AUDIT_CC_DRV',{COLUMN_29:'62140001 DIESEL',COLUMN_30:'12540370'}),
    row(3,'AUDIT_CC_DRV',{COLUMN_29:'63130015 COMMUNICAT. INCEN',COLUMN_30:'2900000'}),
    row(4,'AUDIT_CC_DRV',{COLUMN_29:'Grand Total',COLUMN_30:'15440370'}),
  ]);
  assert.deepEqual(parsed.details.map((item)=>item.coaCode),['62140001','63130015']);
  assert.equal(parsed.details.reduce((sum,item)=>sum.add(item.amount),new Prisma.Decimal(0)).toString(),'15440370');
});

test('equal excluded Product Development base/derivative remains zero-net evidence', () => {
  const base = new Prisma.Decimal('50345895'); const derivative = new Prisma.Decimal('50345895');
  assert.equal(base.sub(derivative).toString(), '0');
});

test('financial 7xx rows cannot be mistaken for an eight-digit derivative detail', () => {
  const parsed = parseCompany2000Derivative([row(1,'AUDIT_CC_DRV',{COLUMN_29:'7xx financial',COLUMN_30:'100'}),row(2,'AUDIT_CC_DRV',{COLUMN_29:'Grand Total',COLUMN_30:'0'})]);
  assert.equal(parsed.details.length,0);
});
