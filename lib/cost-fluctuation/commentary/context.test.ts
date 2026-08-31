import assert from 'node:assert/strict'; import test from 'node:test'; import { lineageKey } from './context';
const a={periodId:1,fiscalYear:2026,fiscalPeriod:7,runId:8,ruleSetVersion:'v1'};
test('lineage key is deterministic and comparison-specific',()=>{assert.equal(lineageKey('MOM',[a],[{...a,periodId:2,runId:7}]),lineageKey('MOM',[a],[{...a,periodId:2,runId:7}]));assert.notEqual(lineageKey('MOM',[a],[a]),lineageKey('YOY',[a],[a]));});
test('lineage change makes previous commentary stale',()=>{assert.notEqual(lineageKey('MOM',[a],[a]),lineageKey('MOM',[{...a,runId:9}],[a]));});
