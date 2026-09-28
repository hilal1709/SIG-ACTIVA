import assert from 'node:assert/strict'; import test from 'node:test';
import { parseBusinessDate, predecessorEndForSuccessor } from './business-date';

test('validTo business date includes exact month-end periodEnd and excludes next day', () => {
  const validTo = parseBusinessDate('2026-07-31', 'validTo', 'end')!;
  assert.equal(validTo.toISOString(), '2026-07-31T23:59:59.999Z');
  assert.equal(new Date('2026-07-31T23:59:59.999Z') <= validTo, true);
  assert.equal(new Date('2026-08-01T00:00:00.000Z') <= validTo, false);
});

test('successor start produces contiguous non-overlapping predecessor end', () => {
  const start = parseBusinessDate('2026-08-01', 'validFrom', 'start')!;
  const end = predecessorEndForSuccessor(start);
  assert.equal(start.toISOString(), '2026-08-01T00:00:00.000Z');
  assert.equal(end.toISOString(), '2026-07-31T23:59:59.999Z');
  assert.equal(start.getTime() - end.getTime(), 1);
});

test('leap-year and year-boundary business dates are deterministic UTC', () => {
  assert.equal(parseBusinessDate('2024-02-29', 'validTo', 'end')?.toISOString(), '2024-02-29T23:59:59.999Z');
  assert.equal(predecessorEndForSuccessor(parseBusinessDate('2027-01-01', 'validFrom', 'start')!).toISOString(), '2026-12-31T23:59:59.999Z');
  assert.throws(() => parseBusinessDate('2026-02-29', 'validFrom', 'start'));
});
