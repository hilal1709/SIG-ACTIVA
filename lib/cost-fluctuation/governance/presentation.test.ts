import assert from 'node:assert/strict';
import test from 'node:test';
import { commentaryActions, explainMaterialityRule, governancePermissions, isCommentaryTarget } from './presentation';

test('governance permissions preserve maker/checker/admin role boundaries', () => {
  assert.deepEqual(governancePermissions('STAFF_ACCOUNTING'), { canPrepare: true, canReview: false, canAdmin: false });
  assert.deepEqual(governancePermissions('SUPERVISOR_ACCOUNTING'), { canPrepare: false, canReview: true, canAdmin: false });
  assert.deepEqual(governancePermissions('AUDITOR_INTERNAL'), { canPrepare: false, canReview: false, canAdmin: false });
});

test('COMPANY and ANALYSIS_BASIS are context, not commentary targets', () => {
  assert.equal(isCommentaryTarget('COMPANY'), false); assert.equal(isCommentaryTarget('ANALYSIS_BASIS'), false);
  for (const target of ['COST_GROUP', 'NATURE', 'COA', 'CALCULATED_ITEM']) assert.equal(isCommentaryTarget(target), true);
});

test('returned commentary must be saved back to DRAFT before submit and reviewed is immutable', () => {
  const maker = governancePermissions('STAFF_ACCOUNTING');
  assert.equal(commentaryActions('RETURNED', maker).canEdit, true);
  assert.equal(commentaryActions('RETURNED', maker).canSubmit, false);
  assert.equal(commentaryActions('DRAFT', maker).canSubmit, true);
  assert.equal(commentaryActions('REVIEWED', maker).immutable, true);
  assert.equal(commentaryActions('REVIEWED', maker).canEdit, false);
});

test('maker/checker action visibility follows lifecycle and actor identity', () => {
  assert.equal(commentaryActions('SUBMITTED', governancePermissions('STAFF_ACCOUNTING'), 10, 20).canCheck, false);
  assert.equal(commentaryActions('SUBMITTED', governancePermissions('SUPERVISOR_ACCOUNTING'), 10, 20).canCheck, true);
  assert.equal(commentaryActions('SUBMITTED', governancePermissions('ADMIN_SYSTEM'), 10, 10).canCheck, false);
  assert.equal(commentaryActions('SUBMITTED', governancePermissions('ADMIN_SYSTEM'), 10, 10).makerCheckerBlocked, true);
});

test('materiality AND/OR explanations do not invent thresholds', () => {
  assert.match(explainMaterialityRule('100', '20', 'AND'), / AND /);
  assert.match(explainMaterialityRule('100', '20', 'OR'), / OR /);
  assert.match(explainMaterialityRule('', '', 'OR'), /No business threshold is assumed/);
});
