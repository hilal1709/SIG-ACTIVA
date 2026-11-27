import test from 'node:test';
import assert from 'node:assert/strict';
import { delta, status, statusLabel, summarize, validateSnapshot, latestPeriod, sortRows, makeCsv } from './model.ts';
const row = (code, base, current, name = 'Synthetic') => ({ code, name, plant:'0000', c:[...Array(8).fill(null),base,current,null,null], q:[...Array(8).fill(null),0,5,null,null] });
const data = [row('A',100,125),row('B',100,105),row('C',100,80),row('D',100,100),row('E',0,50),row('F',100,null),row('G',100,0),row('H',-100,10)];
test('positive-only comparison and null/zero preservation', () => {
  assert.equal(delta(data[0],9,8),25); assert.equal(delta(data[4],9,8),null); assert.equal(delta(data[5],9,8),null); assert.equal(delta(data[6],9,8),null); assert.equal(delta(data[7],9,8),null);
});
test('classification and threshold', () => {
  assert.deepEqual(data.map(d=>status(d,9,8,10)),['alert','up','down','flat','quality','quality','quality','quality']);
  assert.equal(status(data[0],9,8,30),'up'); assert.equal(statusLabel(data[7],9,8,10),'Pembanding negatif');
});
test('summary and ranking', () => {
  const s=summarize(data,9,8,10); assert.deepEqual([s.available,s.comparable.length,s.ups.length,s.downs.length,s.alerts.length,s.missing,s.zero,s.zeroQty,s.invalidBase],[7,4,2,1,1,1,1,0,2]); assert.equal(s.ups[0].code,'A');
});
test('same period', () => {assert.equal(delta(data[0],9,9),0);});
test('validate and latest period', () => {
  assert.deepEqual(validateSnapshot(data),data); assert.equal(latestPeriod(data),9); assert.equal(data[0].q[8],0);
  assert.throws(()=>validateSnapshot([data[0],data[0]]),/Duplikasi/);
  assert.throws(()=>validateSnapshot([{...data[0],c:[1]}]),/Format/);
  assert.throws(()=>validateSnapshot([{...data[0],q:Array(12).fill(NaN)}]),/Format/);
});
test('sorting leaves missing values last in both directions', () => {
  assert.equal(sortRows(data,'dev',false,9,8,10)[0].code,'A'); assert.equal(sortRows(data,'dev',true,9,8,10)[0].code,'C'); assert.equal(delta(sortRows(data,'dev',false,9,8,10).at(-1),9,8),null);
});
test('CSV uses selected data and neutralizes formula injection', () => {
  const csv=makeCsv([row('Z',100,80,'=1+1')],9,8,10); assert.ok(csv.startsWith('\uFEFF')); assert.ok(csv.includes("\"'=1+1\"")); assert.equal(csv.split('\r\n').length,2); assert.match(csv,/"Turun"/);
});
