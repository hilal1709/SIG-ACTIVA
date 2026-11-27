import type { AnalysisNode, Commentary } from './types';
import { formatIdr, formatPercent } from './formatting';

export function AnalysisSummary({ root, commentaries=[] }: { root: AnalysisNode; commentaries?: Commentary[] }) {
  const nodes: AnalysisNode[]=[]; const visit=(n:AnalysisNode)=>{nodes.push(n);n.children?.forEach(visit)}; visit(root);
  const statuses=new Map(commentaries.map(x=>[x.analysisKey,x.status]));
  const material=nodes.filter(n=>n.materialityStatus==='REQUIRES_EXPLANATION').length;
  const open=nodes.filter(n=>n.materialityStatus==='REQUIRES_EXPLANATION'&&statuses.get(n.key)!=='REVIEWED').length;
  const cards=[['Current total',formatIdr(root.currentAmount)],['Comparison total',formatIdr(root.comparisonAmount)],['Total variance',formatIdr(root.varianceAmount)],['Variance %',formatPercent(root.variancePercent,root.variancePercentStatus)],['Material lines',String(material)],['Commentary open',String(open)]];
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">{cards.map(([label,value],i)=><div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"><p className="text-xs font-medium text-slate-500">{label}</p><p className={`${i===2&&root.varianceAmount.startsWith('-')?'text-red-700':'text-slate-900'} mt-2 break-words text-lg font-bold tabular-nums`}>{value}</p></div>)}</div>;
}
