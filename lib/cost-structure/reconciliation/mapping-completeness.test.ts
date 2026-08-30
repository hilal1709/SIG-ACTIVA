import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateMappingCompleteness } from './mapping-completeness';

describe('Phase D mapping completeness', () => {
  it('M-005 reports undisposed amount as the completeness difference', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '001', amount: '100.00', mappingStatus: 'MAPPED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '002', amount: '20.00', mappingStatus: 'EXCLUDED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '003', amount: '30.00', mappingStatus: 'RECLASSIFIED' },
      { logicalSourceCode: 'CC_ADUM', coaCodeRaw: '004', amount: '5.00', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.difference, '5.00');
    assert.equal(value.unmappedAmount, '5.00');
    assert.equal(value.unmappedCoaCount, 1);
  });

  it('does not let positive and negative unmapped COAs net away the blocker', () => {
    const value = calculateMappingCompleteness([
      { logicalSourceCode: 'CC_PASAR', coaCodeRaw: '010', amount: '10.00', mappingStatus: 'UNMAPPED' },
      { logicalSourceCode: 'CC_PASAR', coaCodeRaw: '011', amount: '-10.00', mappingStatus: 'UNMAPPED' },
    ]);
    assert.equal(value.difference, '0.00');
    assert.equal(value.unmappedCoaCount, 2);
  });
});
