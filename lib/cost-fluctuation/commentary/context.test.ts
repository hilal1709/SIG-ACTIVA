import assert from 'node:assert/strict';
import test from 'node:test';
import { lineageKey, locateCommentaryNode } from './context';
import type { ComparedNode, Lineage } from '../analysis/types';

const si: Lineage = { periodId: 1, fiscalYear: 2026, fiscalPeriod: 7, runId: 10, ruleSetVersion: 'ENGINE1_2000_V2', uploadId: 1, basisCode: 'SI' };
const ghopo: Lineage = { periodId: 2, fiscalYear: 2026, fiscalPeriod: 7, runId: 8, ruleSetVersion: 'ENGINE1_7000_V1', uploadId: 2, basisCode: 'GHOPO' };
const deriv: Lineage = { ...ghopo, basisCode: 'DERIV' };

test('lineage key is deterministic, comparison-specific, and preserves dual-basis lineage', () => {
  assert.equal(lineageKey('MOM', [ghopo, deriv], [si]), lineageKey('MOM', [deriv, ghopo], [si]));
  assert.notEqual(lineageKey('MOM', [ghopo, deriv], [si]), lineageKey('YOY', [ghopo, deriv], [si]));
  assert.notEqual(lineageKey('MOM', [ghopo, deriv], [si]), lineageKey('MOM', [ghopo], [si]));
});

test('run, ruleset, upload and basis changes make commentary lineage stale', () => {
  const base = lineageKey('MOM', [si], []);
  assert.notEqual(base, lineageKey('MOM', [{ ...si, runId: 11 }], []));
  assert.notEqual(base, lineageKey('MOM', [{ ...si, ruleSetVersion: 'changed' }], []));
  assert.notEqual(base, lineageKey('MOM', [{ ...si, uploadId: 9 }], []));
  assert.notEqual(base, lineageKey('MOM', [{ ...si, basisCode: 'GHOPO' }], []));
});

test('comparison snapshot changes make commentary lineage stale', () => {
  const comparison = { ...si, periodId: 3, fiscalPeriod: 6, runId: 30, uploadId: 3 };
  const base = lineageKey('MOM', [si], [comparison]);
  assert.notEqual(base, lineageKey('MOM', [si], [{ ...comparison, periodId: 4 }]));
  assert.notEqual(base, lineageKey('MOM', [si], [{ ...comparison, runId: 31 }]));
  assert.notEqual(base, lineageKey('MOM', [si], [{ ...comparison, uploadId: 4 }]));
  assert.notEqual(base, lineageKey('MOM', [si], [{ ...comparison, ruleSetVersion: 'changed' }]));
  assert.notEqual(base, lineageKey('MOM', [si], [{ ...comparison, basisCode: 'GHOPO' }]));
});

const metric = { currentAmount: '1.00', comparisonAmount: '0.00', varianceAmount: '1.00', variancePercent: null, variancePercentStatus: 'NM' as const, contribution: null, contributionStatus: 'NOT_APPLICABLE' as const, contributionBasis: null };
const leaf = (basis: 'GHOPO' | 'DERIV'): ComparedNode => ({ ...metric, key: `basis:${basis}:group:20:nature:27:calculated:DERIV_SOURCE:DERIV_SHEET_AMOUNT`, id: null, code: 'ITEM', label: 'Item', nodeType: 'CALCULATED_ITEM', order: 1 });
const nature = (basis: 'GHOPO' | 'DERIV'): ComparedNode => ({ ...metric, key: `basis:${basis}:group:20:nature:27`, id: 27, code: 'N07', label: 'UUA', nodeType: 'NATURE', order: 1, children: [leaf(basis)] });
const group = (basis: 'GHOPO' | 'DERIV'): ComparedNode => ({ ...metric, key: `basis:${basis}:group:20`, id: 20, code: 'PASAR', label: 'PASAR', nodeType: 'COST_GROUP', order: 1, children: [nature(basis)] });
const basis = (code: 'GHOPO' | 'DERIV'): ComparedNode => ({ ...metric, key: `basis:${code}`, id: null, code, label: code, nodeType: 'ANALYSIS_BASIS', order: 1, children: [group(code)] });
const hierarchy: ComparedNode[] = [{ ...metric, key: 'company:7000', id: 2, code: '7000', label: '7000', nodeType: 'COMPANY', order: 1, children: [basis('GHOPO'), basis('DERIV')] }];

test('basis-qualified targets retain branch Cost Group/Nature context', () => {
  const g = locateCommentaryNode(hierarchy, 'basis:GHOPO:group:20:nature:27')!;
  const d = locateCommentaryNode(hierarchy, 'basis:DERIV:group:20:nature:27')!;
  assert.equal(g.groupId, 20); assert.equal(g.natureId, 27);
  assert.equal(d.groupId, 20); assert.equal(d.natureId, 27);
  assert.notEqual(g.node.key, d.node.key);
  assert.equal(locateCommentaryNode(hierarchy, 'basis:DERIV')?.node.nodeType, 'ANALYSIS_BASIS');
});
