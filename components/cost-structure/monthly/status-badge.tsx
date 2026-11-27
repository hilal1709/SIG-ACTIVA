import { AlertCircle, CheckCircle2, CircleDashed, Clock3 } from 'lucide-react';

export function StatusBadge({ status }: { status: string }) {
  const normalized = status === 'FAILED' ? 'BLOCKED' : status;
  const styles = normalized === 'FINALIZED'
    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
    : normalized === 'CALCULATED' || normalized === 'COST_STRUCTURE_RECONCILED'
      ? 'border-blue-200 bg-blue-50 text-blue-700'
      : normalized === 'BLOCKED'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-slate-200 bg-slate-50 text-slate-700';
  const Icon = normalized === 'FINALIZED' ? CheckCircle2 : normalized === 'BLOCKED' ? AlertCircle : normalized === 'CALCULATED' ? CircleDashed : Clock3;
  return <span className={`inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] font-semibold leading-none ${styles}`}><Icon className="h-3 w-3 shrink-0" aria-hidden="true" /><span className="truncate">{normalized.replaceAll('_', ' ')}</span></span>;
}
