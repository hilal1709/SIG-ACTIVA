import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  authoritativeBaselineStart,
  canCreatePredecessorInterval,
  isAuthoritativeBaselineCandidate,
} from './authoritative-baseline-policy';

describe('authoritative baseline predecessor policy', () => {
  it('locks the baseline to 1 July of the fiscal year', () => {
    assert.equal(authoritativeBaselineStart(2026).toISOString(), '2026-07-01T00:00:00.000Z');
  });

  it('accepts only the exact reviewed/golden July baseline provenance', () => {
    const validFrom = new Date('2026-07-01T00:00:00.000Z');
    assert.equal(isAuthoritativeBaselineCandidate({
      validFrom,
      validTo: null,
      note: 'Golden Company 2000 July 2026 authoritative Summary mapping',
    }, 2026), true);
    assert.equal(isAuthoritativeBaselineCandidate({
      validFrom,
      validTo: null,
      note: 'ordinary future mapping',
    }, 2026), false);
    assert.equal(isAuthoritativeBaselineCandidate({
      validFrom: new Date('2026-08-01T00:00:00.000Z'),
      validTo: null,
      note: 'Golden Company 2000 July 2026 authoritative Summary mapping',
    }, 2026), false);
  });

  it('creates a non-overlapping predecessor ending the day before baseline', () => {
    const baseline = new Date('2026-07-01T00:00:00.000Z');
    assert.equal(canCreatePredecessorInterval(
      new Date('2026-03-01T00:00:00.000Z'),
      baseline,
      [{ validFrom: baseline, validTo: null }],
    ), true);
  });

  it('fails closed when predecessor would overlap or start at/after baseline', () => {
    const baseline = new Date('2026-07-01T00:00:00.000Z');
    assert.equal(canCreatePredecessorInterval(
      new Date('2026-03-01T00:00:00.000Z'),
      baseline,
      [
        { validFrom: new Date('2026-05-01T00:00:00.000Z'), validTo: new Date('2026-05-31T00:00:00.000Z') },
        { validFrom: baseline, validTo: null },
      ],
    ), false);
    assert.equal(canCreatePredecessorInterval(baseline, baseline, [{ validFrom: baseline, validTo: null }]), false);
  });
});
