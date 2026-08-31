'use client';
import { AlertTriangle, Info, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import { AnalysisSummary } from './analysis-summary';
import { AnalysisToolbar } from './analysis-toolbar';
import { AnalysisTreeTable } from './analysis-tree-table';
import { collectOptions, filterTree } from './tree-utils';
import type { AnalysisResponse, Filters } from './types';

type Period={id:number;companyCode:string;fiscalYear:number;fiscalPeriod:number}; const empty:Filters={group:'',nature:'',materialOnly:false,needsCommentary:false};
export default function AnalysisDashboard({periodOptions}:{periodOptions:Period[]}){
 const [company,setCompany]=useState('');const [periodId,setPeriodId]=useState('');const [comparison,setComparison]=useState('MOM');const [filters,setFilters]=useState(empty);const [data,setData]=useState<AnalysisResponse|null>(null);const [loading,setLoading]=useState(false);const [error,setError]=useState<{message:string;kind:string}|null>(null);
 const companies=useMemo(()=>[...new Set(periodOptions.map(x=>x.companyCode))].sort(),[periodOptions]);const periods=periodOptions.filter(x=>x.companyCode===company);const options=collectOptions(data?.hierarchy??[]);const visible=filterTree(data?.hierarchy??[],filters,data?.commentaries);
 const reset=()=>{setData(null);setError(null);setFilters(empty)};
 const load=async()=>{setLoading(true);setError(null);try{const response=await fetch(`/api/cost-fluctuation/commentary?periodId=${periodId}&comparison=${comparison}`);const body=await response.json() as AnalysisResponse;if(!response.ok)throw Object.assign(new Error(body.error??'Analisis tidak dapat dimuat.'),{kind:response.status===401||response.status===403?'auth':response.status===409&&body.code==='FLUCTUATION_INTEGRITY_ERROR'?'integrity':'server'});setData(body)}catch(reason){const e=reason as Error&{kind?:string};setError({message:e.message||'Koneksi ke server gagal.',kind:e.kind??'network'});setData(null)}finally{setLoading(false)}};
 return <section className="space-y-4"><AnalysisToolbar companies={companies} company={company} periods={periods} periodId={periodId} comparison={comparison} filters={filters} groups={options.groups} natures={options.natures} loading={loading} onCompany={value=>{setCompany(value);setPeriodId(String(periodOptions.find(x=>x.companyCode===value)?.id??''));reset()}} onPeriod={value=>{setPeriodId(value);reset()}} onComparison={value=>{setComparison(value);reset()}} onFilters={setFilters} onLoad={load}/>
 {periodOptions.length===0&&<Notice icon="info" text="Belum ada periode Cost Structure berstatus FINALIZED."/>}
 {error&&<Notice icon={error.kind==='integrity'?'integrity':'error'} text={error.kind==='auth'?'Sesi Anda tidak memiliki akses atau telah berakhir. Silakan masuk kembali.':error.message}/>} 
 {data?.status==='UNAVAILABLE'&&<Notice icon="info" text={`${data.comparisonLabel??comparison} — Comparison period not available. Nilai historis tidak diperlakukan sebagai nol.`}/>} 
 {data?.status==='AVAILABLE'&&data.hierarchy?.[0]&&<><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-700">{data.comparisonLabel}</p><p className="text-xs text-slate-500">Nilai analitis read-only dari Engine 2 V2</p></div><AnalysisSummary root={data.hierarchy[0]} commentaries={data.commentaries}/><AnalysisTreeTable nodes={visible} commentaries={data.commentaries}/></>}
 </section>
}
function Notice({icon,text}:{icon:'info'|'integrity'|'error';text:string}){const Icon=icon==='info'?Info:icon==='integrity'?ShieldAlert:AlertTriangle;const tone=icon==='info'?'border-blue-200 bg-blue-50 text-blue-800':icon==='integrity'?'border-red-300 bg-red-50 text-red-800':'border-amber-300 bg-amber-50 text-amber-900';return <div role={icon==='info'?'status':'alert'} className={`flex items-start gap-3 rounded-xl border p-4 ${tone}`}><Icon className="mt-0.5 h-5 w-5 shrink-0"/><p className="text-sm">{text}</p></div>}
