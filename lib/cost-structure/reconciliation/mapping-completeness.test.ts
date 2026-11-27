import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateMappingCompleteness } from './mapping-completeness';

describe('Phase D mapping completeness', () => {
  it('M-005 reports material undisposed amount as the completeness difference', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '001', amount: '100.00', mappingStatus: 'MAPPED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '002', amount: '20.00', mappingStatus: 'EXCLUDED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '003', amount: '30.00', mappingStatus: 'RECLASSIFIED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '004', amount: '5.00', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.difference, '5.00');
    assert.equal(value.blockingDifference, '5.00');
    assert.equal(value.unmappedAmount, '5.00');
    assert.equal(value.unmappedCoaCount, 1);
  });

  it('does not let positive and negative material unmapped COAs net away the blocker', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_PASAR', coaCodeRaw: '010', amount: '10.00', mappingStatus: 'UNMAPPED' },
      { logicalSourceCode: 'CC_PASAR', coaCodeRaw: '011', amount: '-10.00', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.difference, '0.00');
    assert.equal(value.blockingDifference, '0.00');
    assert.equal(value.unmappedCoaCount, 2);
  });

  it('keeps absolute Rp1 unmapped amounts visible but non-blocking', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '66250008', amount: '-1.00', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.difference, '-1.00');
    assert.equal(value.blockingDifference, '0.00');
    assert.equal(value.unmappedCoaCount, 0);
    assert.equal(value.deMinimisUnmappedCoaCount, 1);
  });

  it('aggregates a COA before applying the Rp1 tolerance', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '099', amount: '0.60', mappingStatus: 'UNMAPPED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '099', amount: '0.60', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.unmappedCoaCount, 1);
    assert.equal(value.blockingDifference, '1.20');
  });
});
