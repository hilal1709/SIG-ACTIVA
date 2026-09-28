import { RotateCcw } from 'lucide-react';
import { periodLabel } from './formatting';
import type { Filters } from './types';

type Period = { id: number; companyCode: string; fiscalYear: number; fiscalPeriod: number };
type Props = { companies: string[]; company: string; periods: Period[]; periodId: string; comparison: string; filters: Filters; groups: [string,string][]; natures: [string,string][]; loading: boolean; onCompany(value:string):void; onPeriod(value:string):void; onComparison(value:string):void; onFilters(value:Filters):void; onLoad():void };
const field = 'h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100';

export function AnalysisToolbar(props: Props) {
  return <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Company Code<select className={field} value={props.company} onChange={e=>props.onCompany(e.target.value)}><option value="">Pilih company</option>{props.companies.map(x=><option key={x}>{x}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Periode finalized<select className={field} disabled={!props.company} value={props.periodId} onChange={e=>props.onPeriod(e.target.value)}><option value="">Pilih periode</option>{props.periods.map(x=><option key={x.id} value={x.id}>{periodLabel(x.fiscalYear,x.fiscalPeriod)}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Perbandingan<select className={field} value={props.comparison} onChange={e=>props.onComparison(e.target.value)}><option value="MOM">MoM</option><option value="YOY">YoY</option><option value="YTD">YTD</option></select></label>
      <button className="mt-auto h-10 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50" disabled={!props.periodId||props.loading} onClick={props.onLoad}>{props.loading?'Memuat…':'Tampilkan analisis'}</button>
    </div>
    <div className="flex flex-wrap items-end gap-3 border-t border-slate-100 pt-4">
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Cost Group<select className={field} value={props.filters.group} onChange={e=>props.onFilters({...props.filters,group:e.target.value,nature:''})}><option value="">Semua Cost Group</option>{props.groups.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="grid gap-1 text-xs font-semibold text-slate-600">Nature<select className={field} value={props.filters.nature} onChange={e=>props.onFilters({...props.filters,nature:e.target.value})}><option value="">Semua Nature</option>{props.natures.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label className="flex h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={props.filters.materialOnly} onChange={e=>props.onFilters({...props.filters,materialOnly:e.target.checked})}/> Material saja</label>
      <label className="flex h-10 items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={props.filters.needsCommentary} onChange={e=>props.onFilters({...props.filters,needsCommentary:e.target.checked})}/> Perlu commentary</label>
      <button className="flex h-10 items-center gap-2 rounded-lg border px-3 text-sm" onClick={()=>props.onFilters({group:'',nature:'',materialOnly:false,needsCommentary:false})}><RotateCcw className="h-4 w-4"/>Reset filter</button>
    </div>
  </div>;
}
