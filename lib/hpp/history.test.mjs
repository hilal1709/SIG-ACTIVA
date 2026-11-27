import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHppYear, pivotHppHistory } from './history.ts';
import { summarize, makeCsv } from '../../app/hpp-cost-intelligence/model.ts';
const observation = (period, cogm, deliveryQty, materialCode = 'M01', plant = 'P01', materialName = 'Material') => ({ period, materialCode, materialName, plant, cogm, deliveryQty });

test('year validation and automatic selection signal', () => {
  assert.equal(parseHppYear(null), null);
  assert.equal(parseHppYear('2026'), 2026);
  for (const v of ['','26','1999','2101','2026.0','2026x',' 2026']) assert.throws(() => parseHppYear(v));
});
test('pivot keeps zero, missing months, decimals and negatives', () => {
  const [r] = pivotHppHistory([observation(10,'12.345678901234','-2'),observation(9,'0',null),observation(1,null,'0')]);
  assert.equal(r.c.length,12); assert.equal(r.q.length,12);
  assert.equal(r.c[9],12.345678901234); assert.equal(r.c[8],0); assert.equal(r.q[8],null);
  assert.equal(r.c[0],null); assert.equal(r.q[0],0); assert.equal(r.q[9],-2); assert.equal(r.c[11],null);
});
test('separate material and plant; most recent description is deterministic', () => {
  const rows=pivotHppHistory([observation(10,12,3,'A','1','New'),observation(1,10,1,'A','1','Old'),observation(10,13,2,'A','2'),observation(10,14,3,'B','1')]);
  assert.equal(rows.length,3); assert.equal(rows[0].name,'New'); assert.equal(rows[0].c[0],10);
});
test('retain an explicitly blank combination', () => {
  const [r]=pivotHppHistory([observation(1,null,null)]); assert.ok(r.c.every(v=>v===null)); assert.ok(r.q.every(v=>v===null));
});
test('reject duplicate observation or invalid period and nonfinite values', () => {
  assert.throws(()=>pivotHppHistory([observation(1,1,1),observation(1,2,2)]),/Duplikasi/);
  assert.throws(()=>pivotHppHistory([observation(13,1,1)]),/Periode/);
  assert.throws(()=>pivotHppHistory([observation(1,'Infinity',1)]),/Nilai/);
});
test('dashboard model and CSV work for a non-2026 database year', () => {
  const rows=pivotHppHistory([observation(9,100,1),observation(10,120,2)]);
  assert.equal(summarize(rows,9,8,10).alerts.length,1);
  assert.match(makeCsv(rows,9,8,10,2027),/"2027"/);
});
test('empty history yields no observations', () => assert.deepEqual(pivotHppHistory([]),[]));
