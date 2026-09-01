import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  coaFamilyPrefix,
  coaFamilyPrefixes,
  inferFamilyMappingTarget,
  inferHierarchicalFamilyMappingTarget,
  type FamilyMappingEvidence,
} from './family-mapping-policy';

const evidence = (overrides: Partial<FamilyMappingEvidence> = {}): FamilyMappingEvidence => ({
  companyId: 1,
  coaCode: '63140001',
  mappingAction: 'INCLUDE',
  groupCode: 'ADUM',
  natureCode: 'N04',
  ...overrides,
});

describe('COA family mapping policy', () => {
  it('returns four-digit then three-digit family keys', () => {
    assert.deepEqual(coaFamilyPrefixes('63140005'), ['6314', '631']);
    assert.equal(coaFamilyPrefix('63140005'), '6314');
    assert.deepEqual(coaFamilyPrefixes('ABC'), []);
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

  it('falls back from an empty four-digit family to a unanimous three-digit family', () => {
    const value = inferHierarchicalFamilyMappingTarget([
      { familyPrefix: '6783', evidence: [] },
      {
        familyPrefix: '678',
        evidence: [
          evidence({ coaCode: '67810001', natureCode: 'N07' }),
          evidence({ coaCode: '67840001', natureCode: 'N07' }),
          evidence({ coaCode: '67870004', natureCode: 'N07' }),
        ],
      },
    ], 1);
    assert.equal(value?.familyPrefix, '678');
    assert.equal(value?.natureCode, 'N07');
    assert.equal(value?.evidenceCoaCount, 3);
  });

  it('does not let a broad family hide a conflicting narrower family', () => {
    const value = inferHierarchicalFamilyMappingTarget([
      {
        familyPrefix: '6834',
        evidence: [
          evidence({ coaCode: '68340001', natureCode: 'N07' }),
          evidence({ coaCode: '68340002', natureCode: 'N08' }),
        ],
      },
      {
        familyPrefix: '683',
        evidence: [
          evidence({ coaCode: '68310001', natureCode: 'N08' }),
          evidence({ coaCode: '68320004', natureCode: 'N08' }),
        ],
      },
    ], 1);
    assert.equal(value, null);
  });

  it('requires at least two distinct COAs before using the three-digit fallback', () => {
    const value = inferHierarchicalFamilyMappingTarget([
      { familyPrefix: '6535', evidence: [] },
      {
        familyPrefix: '653',
        evidence: [
          evidence({ coaCode: '65310001', natureCode: 'N05' }),
          evidence({ coaCode: '65310001', natureCode: 'N05' }),
        ],
      },
    ], 1);
    assert.equal(value, null);
  });
});
