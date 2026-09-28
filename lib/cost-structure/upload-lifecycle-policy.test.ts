import assert from 'node:assert/strict';
import test from 'node:test';
import { ARCHIVED_UPLOAD_STATUS, evaluateUploadLifecycle } from './upload-lifecycle-policy';

const base = {
  periodStatus: 'SOURCE_VALIDATION',
  uploadStatus: 'VALIDATED',
  isActiveVersion: true,
  periodCalculationRunCount: 0,
  periodMappingMutationCount: 0,
  uploadAdjustmentCount: 0,
};

test('hard delete is allowed only before calculation or reusable mapping lineage exists', () => {
  assert.equal(evaluateUploadLifecycle(base).canDelete, true);
  assert.equal(evaluateUploadLifecycle({ ...base, periodCalculationRunCount: 1 }).canDelete, false);
  const mapped = evaluateUploadLifecycle({ ...base, periodMappingMutationCount: 1 });
  assert.equal(mapped.canDelete, false);
  assert.match(mapped.deleteReason ?? '', /mapping reusable/i);
});

test('FINALIZED periods are immutable for delete and archive', () => {
  const policy = evaluateUploadLifecycle({ ...base, periodStatus: 'FINALIZED', isActiveVersion: false });
  assert.equal(policy.canDelete, false);
  assert.equal(policy.canArchive, false);
});

test('an upload-level adjustment blocks hard delete', () => {
  const policy = evaluateUploadLifecycle({ ...base, uploadAdjustmentCount: 1 });
  assert.equal(policy.canDelete, false);
  assert.match(policy.deleteReason ?? '', /adjustment/i);
});

test('archive is allowed only after an upload is superseded', () => {
  assert.equal(evaluateUploadLifecycle(base).canArchive, false);
  assert.equal(evaluateUploadLifecycle({ ...base, isActiveVersion: false }).canArchive, true);
});

test('already archived uploads are not archived twice but may still be deleted only when no lineage exists', () => {
  const policy = evaluateUploadLifecycle({ ...base, uploadStatus: ARCHIVED_UPLOAD_STATUS, isActiveVersion: false });
  assert.equal(policy.canArchive, false);
  assert.equal(policy.canDelete, true);
});
