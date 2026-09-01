import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildIssueBatch, type DesiredIssueMap, type UnresolvedPhaseDIssue } from './issue-batch';

const desired = (
  sourceRowId: number,
  issueCode: string | null,
  severity: 'ERROR' | 'WARNING' = 'ERROR'
) => ({
  sourceRowId,
  issueCode,
  severity,
  message: issueCode ? `[CC_PROD:${sourceRowId}] desired ${issueCode}` : null,
  resolutionType: 'MAPPING_RERUN_RESOLVED' as const,
  updateMetadata: true,
});

test('500+ COA issue synchronization produces the same unresolved issue state with batched mutations', () => {
  const existing: UnresolvedPhaseDIssue[] = [];
  const wanted: DesiredIssueMap = new Map();

  for (let index = 1; index <= 540; index += 1) {
    const context = `[CC_PROD:${index}]`;
    const oldCode = index % 3 === 0 ? 'MAPPING_TARGET_INVALID' : 'UNMAPPED_COA';
    existing.push({
      id: index,
      sourceRowId: index,
      issueCode: oldCode,
      severity: index % 2 ? 'ERROR' : 'WARNING',
      message: `${context} old ${oldCode}`,
    });

    if (index <= 180) wanted.set(context, desired(index, null)); // mapping succeeds
    else if (index <= 360) wanted.set(context, desired(index, 'MAPPING_AMBIGUOUS'));
    else wanted.set(context, desired(index, 'UNMAPPED_COA', index % 2 ? 'ERROR' : 'WARNING'));
  }

  const batch = buildIssueBatch(6, existing, wanted);
  const resolved = new Set([...batch.resolve.values()].flat());
  const unresolved = [
    ...existing.filter((issue) => !resolved.has(issue.id)).map((issue) => {
      const changed = batch.update.find((update) => update.id === issue.id);
      return changed ? { ...issue, ...changed } : issue;
    }),
    ...batch.create.map((issue, offset) => ({ ...issue, id: 10_000 + offset })),
  ];

  assert.equal(unresolved.length, 360);
  assert.equal(unresolved.filter((issue) => issue.issueCode === 'MAPPING_AMBIGUOUS').length, 180);
  assert.equal(unresolved.filter((issue) => issue.issueCode === 'UNMAPPED_COA').length, 180);
  assert.equal(unresolved.filter((issue) => issue.issueCode === 'UNMAPPED_COA' && issue.severity === 'WARNING').length, 90);
  assert.equal(batch.create.length, 240);
});

test('unchanged issues require no writes and obsolete duplicate codes preserve legacy semantics', () => {
  const context = '[CC_ADUM:1000]';
  const existing = [
    { id: 1, sourceRowId: 10, issueCode: 'UNMAPPED_COA', severity: 'ERROR', message: `${context} current` },
    { id: 2, sourceRowId: 11, issueCode: 'UNMAPPED_COA', severity: 'ERROR', message: `${context} duplicate` },
    { id: 3, sourceRowId: 10, issueCode: 'MAPPING_TARGET_INVALID', severity: 'ERROR', message: `${context} obsolete` },
  ];
  const wanted: DesiredIssueMap = new Map([[context, {
    sourceRowId: 10,
    issueCode: 'UNMAPPED_COA',
    severity: 'ERROR',
    message: `${context} current`,
    resolutionType: 'MAPPING_RERUN_RESOLVED',
    updateMetadata: true,
  }]]);

  const batch = buildIssueBatch(6, existing, wanted);
  assert.deepEqual(batch.resolve.get('MAPPING_RERUN_RESOLVED'), [3]);
  assert.equal(batch.create.length, 0);
  assert.equal(batch.update.length, 0);
});

test('Phase D database pattern preloads once and uses batched issue and source-row writes', async () => {
  const source = await readFile(path.resolve('lib/cost-structure/reconciliation/service.ts'), 'utf8');
  assert.equal(source.match(/costValidationIssue\.findMany/g)?.length, 1);
  assert.match(source, /costValidationIssue\.createMany/);
  assert.match(source, /costValidationIssue\.updateMany/);
  assert.match(source, /UPDATE "cost_source_rows" AS row/);
  assert.doesNotMatch(source, /syncMappingIssue/);
});
