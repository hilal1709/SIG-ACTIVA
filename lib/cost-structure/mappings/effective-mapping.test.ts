import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { appliesAt, overlapping, previousDay, validToBeforeNext } from './effective-mapping';

describe('effective-dated source mapping', () => {
  it('M-003 selects an inclusive interval', () => {
    const old = { validFrom: new Date('2026-01-01'), validTo: new Date('2026-12-31') };
    assert.equal(appliesAt(old, new Date('2026-07-01')), true);
    assert.equal(appliesAt(old, new Date('2027-01-01')), false);
  });

  it('detects overlaps without an invalid unique constraint', () => {
    assert.equal(overlapping([
      { validFrom: new Date('2026-01-01'), validTo: null },
      { validFrom: new Date('2027-01-01'), validTo: null },
    ]), true);
  });

  it('closes an old interval one day before a replacement', () => {
    assert.equal(previousDay(new Date('2027-01-01')).toISOString().slice(0, 10), '2026-12-31');
  });

  it('bounds a newly inserted historical mapping before the next future interval', () => {
    const validTo = validToBeforeNext(new Date('2026-07-01'), [
      { validFrom: new Date('2027-01-01'), validTo: null },
    ]);
    assert.equal(validTo?.toISOString().slice(0, 10), '2026-12-31');
    assert.equal(overlapping([
      { validFrom: new Date('2026-07-01'), validTo },
      { validFrom: new Date('2027-01-01'), validTo: null },
    ]), false);
  });
});
