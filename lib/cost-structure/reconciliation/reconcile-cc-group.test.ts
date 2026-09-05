import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { reconcileCcGroup } from './reconcile-cc-group';

const row = (coaCodeRaw: string | null, descriptionRaw: string, amount: string) => ({ coaCodeRaw, descriptionRaw, amount });
describe('Phase D CC Group reconciliation', () => {
  it('CCG-001 reconciles exact Decimal detail and reported total', () => assert.deepEqual(reconcileCcGroup([row('001', 'A', '10.10'), row('002', 'B', '20.20'), row(null, 'TOTAL', '30.30')]).status, 'RECONCILED'));
  it('CCG-002 blocks a Rp1 mismatch', () => { const value = reconcileCcGroup([row('001', 'A', '100.00'), row(null, 'TOTAL', '99.00')]); assert.equal(value.status, 'NOT_RECONCILED'); assert.equal(value.difference, '1.00'); assert.equal(value.issueCode, 'CC_GROUP_NOT_RECONCILED'); });
  it('CCG-003 never double counts the total row', () => { const value = reconcileCcGroup([row('001', 'A', '50.00'), row('002', 'B', '50.00'), row(null, 'GRAND TOTAL', '100.00')]); assert.equal(value.detailAmount, '100.00'); assert.equal(value.status, 'RECONCILED'); });
  it('CCG-004 never double counts controlled subtotals', () => { const value = reconcileCcGroup([row('001', 'A', '50.00'), row(null, 'SUBTOTAL', '50.00'), row(null, 'TOTAL', '50.00')]); assert.equal(value.detailAmount, '50.00'); });
  it('reconciles the verified SAP * Debit row and ignores ** Over/Underabsorption duplicate control', () => { const value = reconcileCcGroup([row('61110002', '61110002 LIMESTONE', '10.00'), row('Debit', '* Debit', '10.00'), row('Over/Und', '** Over/Underabsorption', '10.00')]); assert.equal(value.detailAmount, '10.00'); assert.equal(value.reportedAmount, '10.00'); assert.equal(value.status, 'RECONCILED'); });
  it('does not guess when totals are missing or ambiguous', () => { assert.equal(reconcileCcGroup([row('1', 'A', '1.00')]).issueCode, 'CC_GROUP_TOTAL_NOT_FOUND'); assert.equal(reconcileCcGroup([row(null, 'TOTAL', '1.00'), row(null, 'GRAND TOTAL', '1.00')]).issueCode, 'CC_GROUP_TOTAL_AMBIGUOUS'); });
});
