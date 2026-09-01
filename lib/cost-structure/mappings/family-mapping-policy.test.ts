import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { coaFamilyPrefix, inferFamilyMappingTarget, type FamilyMappingEvidence } from './family-mapping-policy';

const evidence = (overrides: Partial<FamilyMappingEvidence> = {}): FamilyMappingEvidence => ({
  companyId: 1,
  coaCode: '63140001',
  mappingAction: 'INCLUDE',
  groupCode: 'ADUM',
  natureCode: 'N04',
  ...overrides,
});

describe('COA family mapping policy', () => {
  it('uses the first four digits as the family key', () => {
    assert.equal(coaFamilyPrefix('63140005'), '6314');
    assert.equal(coaFamilyPrefix('ABC'), null);
  });

  it('prefers unanimous same-company family evidence', () => {
    const value = inferFamilyMappingTarget([
      evidence({ coaCode: '63140001' }),
      evidence({ coaCode: '63140002' }),
      evidence({ companyId: 2, natureCode: 'N09' }),
    ], 1);
    assert.deepEqual(value, {
      mappingAction: 'INCLUDE',
      groupCode: 'ADUM',
      natureCode: 'N04',
      scope: 'SAME_COMPANY',
      evidenceCount: 2,
    });
  });

  it('fails closed when same-company family targets conflict', () => {
    const value = inferFamilyMappingTarget([
      evidence({ natureCode: 'N04' }),
      evidence({ coaCode: '63140002', natureCode: 'N07' }),
      evidence({ companyId: 2, natureCode: 'N04' }),
    ], 1);
    assert.equal(value, null);
  });

  it('can use unanimous cross-company evidence when the current company has none', () => {
    const value = inferFamilyMappingTarget([
      evidence({ companyId: 2, coaCode: '65350001', natureCode: 'N05' }),
      evidence({ companyId: 3, coaCode: '65350002', natureCode: 'N05' }),
    ], 1);
    assert.equal(value?.scope, 'CROSS_COMPANY');
    assert.equal(value?.natureCode, 'N05');
  });

  it('never infers RECLASS automatically', () => {
    const value = inferFamilyMappingTarget([
      evidence({ companyId: 2, mappingAction: 'RECLASS', natureCode: 'N05' }),
    ], 1);
    assert.equal(value, null);
  });
});
