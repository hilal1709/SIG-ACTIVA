'use client';
import Link from 'next/link';
import type { MonthlyPeriod } from './types';
import { canOpenProcess, displayGroupCodes } from './explorer-utils';
import { StatusBadge } from './status-badge';

export const money = (value: string | null | undefined) => {
  if (value == null) return '—';
  const negative = value.startsWith('-'); const [integer, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const decimals = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.')}${decimals ? `,${decimals}` : ''}`;
};

export default function PeriodDetail({ period }: { period: MonthlyPeriod }) {
  const run = period.run;
  const result = (code: string) => run?.results.find((item) => item.resultCode === `TOTAL_${code === 'TOTAL' ? 'COMPANY' : code}`)?.amount;
  const processLink = canOpenProcess(period) && period.upload ? `/cost-structure/upload/${period.upload.id}` : null;
  return <div className="space-y-4 border-t bg-muted/10 p-4 sm:p-5">
    <div className="flex min-w-0 flex-wrap items-start justify-between gap-3"><div className="min-w-0"><p className="font-semibold">Company {period.companyCode} · {period.fiscalYear}/{String(period.fiscalPeriod).padStart(2, '0')}</p><div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><StatusBadge status={period.status} /><span>Upload {period.upload ? `v${period.upload.version} (${period.upload.status})` : '—'}</span><span>Source reconciliation {['SOURCE_RECONCILED', 'CALCULATED', 'COST_STRUCTURE_RECONCILED', 'FINALIZED'].includes(period.status) ? 'RECONCILED' : 'PENDING'}</span></div></div>{processLink && <Link href={processLink} className="rounded-md border border-primary px-3 py-2 text-sm font-medium text-primary hover:bg-primary/5">Buka proses</Link>}</div>
    {run?.errorMessage && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"><p className="font-semibold">Proses terakhir terhenti</p><p className="mt-1 break-words">{run.errorMessage}</p>{processLink && <Link href={processLink} className="mt-2 inline-block font-medium underline">Lihat tahap proses</Link>}</div>}
    {run && <>
      <div className={`grid min-w-0 gap-2 ${period.companyCode === '7000' ? 'sm:grid-cols-4' : 'sm:grid-cols-3'}`}>{displayGroupCodes(period.companyCode).map((code) => <div key={code} className="min-w-0 rounded-lg border bg-card p-3"><p className="text-xs text-muted-foreground">{code}</p><p className="break-words font-semibold tabular-nums">Rp {money(result(code))}</p></div>)}</div>
      <p className="break-words text-xs text-muted-foreground">Run #{run.runNumber} · {run.status} · {run.ruleSetVersion} · {run.completedAt ?? 'RUNNING'} · {run.actualLineCount} lines</p>
      <div className="max-w-full overflow-x-auto rounded-lg border"><table className="min-w-[520px] w-full text-sm"><thead className="bg-muted/40"><tr className="border-b text-left"><th className="p-2">Group</th><th>Nature</th><th className="pr-2 text-right">Amount</th></tr></thead><tbody>{run.results.filter((item) => item.resultType === 'NATURE').map((item) => <tr key={item.id} className="border-b"><td className="p-2">{item.costGroupCode}</td><td>{item.natureName}{item.natureCalculationType === 'RESIDUAL' ? ' (Residual)' : ''}{item.natureCode === 'OA' ? ' (OA Formula · di dalam PASAR)' : ''}</td><td className="pr-2 text-right tabular-nums">{money(item.amount)}</td></tr>)}</tbody></table></div>
      <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">{run.results.filter((item) => item.resultType === 'CONTROL').map((item) => <p className="break-words" key={item.id}>{item.resultCode}: {item.reconciliationStatus} (difference {money(item.reconciliationDifference)})</p>)}</div>
      <p className="text-xs text-muted-foreground">Snapshot upload/source state dan deterministic mapping dipertahankan pada setiap run.</p>
    </>}
  </div>;
}
