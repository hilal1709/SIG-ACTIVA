'use client';
import { ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { MonthlyPeriod } from './types';
import { initialExpandedPeriod, isBlocked, nextExpandedPeriod } from './explorer-utils';
import PeriodDetail, { money } from './period-detail';
import { StatusBadge } from './status-badge';

const month = (period: MonthlyPeriod) => new Intl.DateTimeFormat('id-ID', { month: 'short' }).format(new Date(Date.UTC(2020, period.fiscalPeriod - 1, 1)));
export default function CompanyPeriodGroup({ companyCode, periods }: { companyCode: string; periods: MonthlyPeriod[] }) {
  const [open, setOpen] = useState<number | null>(() => initialExpandedPeriod(periods));
  const finalized = periods.filter((p) => p.status === 'FINALIZED').length;
  const calculated = periods.filter((p) => ['CALCULATED', 'COST_STRUCTURE_RECONCILED'].includes(p.status)).length;
  return <section className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-sm">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-2 border-b p-4"><div><h2 className="font-semibold">Company {companyCode}</h2><p className="text-xs text-muted-foreground">{periods[0]?.fiscalYear} · {periods.length} periods</p></div><p className="text-xs text-muted-foreground">{finalized} Finalized · {calculated} Calculated · {periods.length - finalized - calculated} Pending</p></header>
    <div className="hidden grid-cols-[1fr_1.3fr_1fr_1.4fr_2rem] gap-3 border-b bg-muted/30 px-4 py-2 text-xs font-medium text-muted-foreground sm:grid"><span>Period</span><span>Status</span><span>Upload</span><span className="text-right">Total</span><span /></div>
    {periods.map((period) => { const expanded = open === period.id; const total = period.run?.results.find((r) => r.resultCode === 'TOTAL_COMPANY')?.amount; return <article key={period.id} className="min-w-0 border-b last:border-b-0">
      <button type="button" aria-expanded={expanded} onClick={() => setOpen((current) => nextExpandedPeriod(current, period.id))} className="grid min-h-14 w-full min-w-0 grid-cols-[1fr_auto] items-center gap-3 p-4 text-left hover:bg-muted/30 sm:grid-cols-[1fr_1.3fr_1fr_1.4fr_2rem]">
        <span className="font-medium">{month(period)} {period.fiscalYear}</span><span className="sm:order-none"><StatusBadge status={isBlocked(period) ? 'BLOCKED' : period.status} /></span><span className="text-xs text-muted-foreground">Upload {period.upload ? `v${period.upload.version}` : '—'}</span><span className="min-w-0 break-words text-sm tabular-nums sm:text-right">Rp {money(total)}</span><ChevronDown aria-hidden="true" className={`h-5 w-5 justify-self-end transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>{expanded && <PeriodDetail period={period} />}
    </article>; })}
  </section>;
}
