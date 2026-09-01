import assert from 'node:assert/strict';
import test from 'node:test';
import { formatIdr, formatPercent } from '../../../components/cost-fluctuation/analysis/formatting';
import { allExpandableKeys, collectOptions, commentaryStatus, filterTree, flattenVisible } from '../../../components/cost-fluctuation/analysis/tree-utils';
import type { AnalysisNode } from '../../../components/cost-fluctuation/analysis/types';

const metric = { currentAmount:'1000.00', comparisonAmount:'0.00', varianceAmount:'1000.00', variancePercent:null, variancePercentStatus:'NM', contribution:null, contributionStatus:'PARENT_ZERO', contributionBasis:null };
const leaf=(basis:string,type:'COA'|'CALCULATED_ITEM',materialityStatus='NORMAL'):AnalysisNode=>({ ...metric,key:`basis:${basis}:group:1:nature:1:${type.toLowerCase()}`,id:type==='COA'?1:null,code:type==='COA'?'510000':'RESIDUAL',label:type==='COA'?'Account':'Calculated residual',nodeType:type,materialityStatus });
const basis=(code:'GHOPO'|'DERIV'):AnalysisNode=>({ ...metric,key:`basis:${code}`,id:null,code,label:code,nodeType:'ANALYSIS_BASIS',materialityStatus:'NOT_APPLICABLE',children:[{...metric,key:`basis:${code}:group:1`,id:1,code:'HPP',label:'HPP',nodeType:'COST_GROUP',materialityStatus:'NORMAL',children:[{...metric,key:`basis:${code}:group:1:nature:1`,id:1,code:'N1',label:'Nature',nodeType:'NATURE',materialityStatus:'NORMAL',children:[leaf(code,code==='DERIV'?'CALCULATED_ITEM':'COA','REQUIRES_EXPLANATION')]}]}]});
const tree:AnalysisNode[]=[{...metric,key:'company:7',id:7,code:'7000',label:'Company 7000',nodeType:'COMPANY',materialityStatus:'NOT_APPLICABLE',children:[basis('GHOPO'),basis('DERIV')]}];

test('hierarchy traversal expands ancestors and keeps basis-qualified rows separate',()=>{
  const keys=allExpandableKeys(tree); assert(keys.includes('basis:GHOPO')); assert(keys.includes('basis:DERIV'));
  const rows=flattenVisible(tree,new Set(keys)); assert.equal(rows.filter(row=>row.nodeType==='ANALYSIS_BASIS').length,2); assert.notEqual(rows.find(row=>row.code==='GHOPO')?.key,rows.find(row=>row.code==='DERIV')?.key);
});

test('filter choices retain analysis-basis context for duplicate group and nature names',()=>{
  const options=collectOptions(tree);
  assert.deepEqual(options.groups.map(([,label])=>label),['GHOPO · HPP — HPP','DERIV · HPP — HPP']);
  assert.deepEqual(options.natures.map(([,label])=>label),['GHOPO · HPP — HPP · Nature','DERIV · HPP — HPP · Nature']);
});

test('material and commentary filters preserve matching ancestry',()=>{
  const result=filterTree(tree,{group:'',nature:'',materialOnly:true,needsCommentary:true},[]); const rows=flattenVisible(result,new Set(allExpandableKeys(result))); assert.equal(rows.filter(row=>['COA','CALCULATED_ITEM'].includes(row.nodeType)).length,2);
  const reviewed=filterTree(tree,{group:'',nature:'',materialOnly:false,needsCommentary:true},[{id:1,analysisKey:leaf('GHOPO','COA').key,status:'REVIEWED',reason:''}]); assert.equal(flattenVisible(reviewed,new Set(allExpandableKeys(reviewed))).filter(row=>row.nodeType==='COA').length,0);
});

test('N/M, zero, unavailable, and Indonesian currency are visually distinct without float precision loss',()=>{
  assert.equal(formatPercent(null,'NM'),'N/M');
  assert.equal(formatPercent('0','AVAILABLE'),'0,00%');
  assert.equal(formatPercent('12.345','AVAILABLE'),'12,35%');
  assert.equal(formatIdr(null),'—');
  assert.equal(formatIdr('-1000'),'-Rp\u00a01.000,00');
  assert.equal(formatIdr('0'),'Rp\u00a00,00');
  assert.equal(formatIdr('9007199254740993.12'),'Rp\u00a09.007.199.254.740.993,12');
});

test('calculated item remains distinct and context nodes are not commentary targets',()=>{
  const rows=flattenVisible(tree,new Set(allExpandableKeys(tree))); assert.equal(rows.find(row=>row.nodeType==='CALCULATED_ITEM')?.id,null); assert.equal(commentaryStatus(tree[0],new Map()),'—'); assert.equal(commentaryStatus(tree[0].children![0],new Map()),'—');
});
