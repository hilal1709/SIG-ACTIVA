import assert from 'node:assert/strict';
import test from 'node:test';
import { nextStatus, WORKFLOW_AUDIT, type WorkflowStatus } from './workflow';

type Row = {
  comparison: string;
  reason: string;
  status: WorkflowStatus;
  version: number;
  history: WorkflowStatus[];
  audits: string[];
  coaId: number | null;
};

const save = (row: Row | null, comparison: string, reason: string, coaId: number | null = null): Row => ({
  comparison,
  reason,
  status: nextStatus(row?.status ?? null, 'SAVE', reason, '', 1, 1),
  version: (row?.version ?? 0) + 1,
  history: [...(row?.history ?? []), 'DRAFT'],
  audits: [...(row?.audits ?? []), WORKFLOW_AUDIT.SAVE],
  coaId,
});

const act = (row: Row, action: 'SUBMIT' | 'RETURN' | 'REVIEW', actor = 2, note = 'review note'): Row => ({
  ...row,
  status: nextStatus(row.status, action, row.reason, note, 1, actor),
  version: row.version + 1,
  history: [...row.history, nextStatus(row.status, action, row.reason, note, 1, actor)],
  audits: [...row.audits, WORKFLOW_AUDIT[action]],
});

test('COM-001 keeps separate MOM YOY YTD reasons', () => {
  assert.deepEqual(['MOM', 'YOY', 'YTD'].map((comparison) => save(null, comparison, `reason-${comparison}`).reason), ['reason-MOM', 'reason-YOY', 'reason-YTD']);
});

test('COM-002 initial DRAFT saves again with monotonic append-only history then submits', () => {
  let row = save(null, 'MOM', 'reason');
  row = save(row, 'MOM', 'revised');
  row = act(row, 'SUBMIT');
  assert.equal(row.status, 'SUBMITTED');
  assert.deepEqual(row.history, ['DRAFT', 'DRAFT', 'SUBMITTED']);
  assert.equal(row.version, 3);
  assert.deepEqual(row.audits, ['SAVE_COMMENTARY', 'SAVE_COMMENTARY', 'SUBMIT_COMMENTARY']);
});

test('COM-003 return requires note and writes audit/history', () => {
  const submitted = act(save(null, 'MOM', 'reason'), 'SUBMIT');
  assert.throws(() => act(submitted, 'RETURN', 2, ''));
  const returned = act(submitted, 'RETURN');
  assert.equal(returned.status, 'RETURNED');
  assert.equal(returned.audits.at(-1), 'RETURN_COMMENTARY');
});

test('COM-003 maker cannot return own submitted commentary', () => {
  const submitted = act(save(null, 'MOM', 'reason'), 'SUBMIT');
  assert.throws(() => act(submitted, 'RETURN', 1), /Maker\/checker/);
  assert.equal(act(submitted, 'RETURN', 2).status, 'RETURNED');
});

test('COM-004 returned must save draft before resubmit and retains versions', () => {
  let row = act(act(save(null, 'MOM', 'reason'), 'SUBMIT'), 'RETURN');
  assert.throws(() => act(row, 'SUBMIT'));
  row = save(row, 'MOM', 'fixed');
  row = act(row, 'SUBMIT');
  assert.deepEqual(row.history, ['DRAFT', 'SUBMITTED', 'RETURNED', 'DRAFT', 'SUBMITTED']);
});

test('COM-005 actual maker user id cannot review own commentary', () => {
  const row = act(save(null, 'MOM', 'reason'), 'SUBMIT');
  assert.throws(() => act(row, 'REVIEW', 1), /Maker/);
  assert.equal(act(row, 'REVIEW', 2).audits.at(-1), 'REVIEW_COMMENTARY');
});

test('SUBMITTED and REVIEWED are immutable through save and invalid transitions fail', () => {
  const submitted = act(save(null, 'MOM', 'reason'), 'SUBMIT');
  assert.throws(() => save(submitted, 'MOM', 'edit'));
  const reviewed = act(submitted, 'REVIEW');
  assert.throws(() => save(reviewed, 'MOM', 'edit'));
  assert.throws(() => act(reviewed, 'RETURN'));
});

test('submit requires nonblank reason and calculated item has no fake COA', () => {
  assert.throws(() => act(save(null, 'MOM', ''), 'SUBMIT'));
  assert.equal(save(null, 'MOM', 'calculated explanation', null).coaId, null);
});
