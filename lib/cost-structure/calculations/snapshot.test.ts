import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMappingSnapshot } from './snapshot';

test('mapping snapshot is stable, deterministic and includes EXCLUDE', () => {
  const date = new Date('2026-01-01T00:00:00.000Z');
  const records = [{ mappingId: 2, companyId: 1, sourceLogicalCode: 'CC_PASAR', coaId: 8, mappingAction: 'EXCLUDE', costGroupId: null, natureId: null, validFrom: date, validTo: null, updatedAt: date }, { mappingId: 1, companyId: 1, sourceLogicalCode: 'CC_ADUM', coaId: 7, mappingAction: 'INCLUDE', costGroupId: 2, natureId: 3, validFrom: date, validTo: null, updatedAt: date }];
  assert.deepEqual(buildMappingSnapshot(records), buildMappingSnapshot([...records].reverse()));
  assert.equal(buildMappingSnapshot(records)[1].mappingAction, 'EXCLUDE');
});
