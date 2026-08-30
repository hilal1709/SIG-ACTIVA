import { prisma } from '@/lib/prisma';
import CalculationButton from './calculation-button';

const money = (value: { toString(): string } | null | undefined) => {
  if (!value) return '—';
  const raw = value.toString();
  const negative = raw.startsWith('-');
  const unsigned = negative ? raw.slice(1) : raw;
  const [integer, fraction = ''] = unsigned.split('.');
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const decimals = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}${grouped}${decimals ? `,${decimals}` : ''}`;
};

export default async function MonthlyCostStructurePage() {
  const periods = await prisma.costPeriod.findMany({ include: { company: true, uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 }, activeCalculationRun: { include: { results: { include: { costGroup: true, nature: true } }, _count: { select: { actualLines: true } } } } }, orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { companyId: 'asc' }] });
  return (
    <section className="space-y-6 p-6"><div><h1 className="text-2xl font-bold">Cost Structure Bulanan</h1><p className="text-sm text-slate-500">Workspace provisional Engine 1 Company 2000.</p></div>
      {periods.length === 0 && <div className="rounded-xl border bg-white p-6 text-sm text-slate-500">Belum ada periode Cost Structure.</div>}
      {periods.map((period) => { const run = period.activeCalculationRun; const result = (code: string) => run?.results.find((item) => item.resultCode === code)?.amount; const eligible = period.company.companyCode === '2000' && ['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status); return <article key={period.id} className="rounded-xl border bg-white p-5 shadow-sm"><div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="font-semibold">Company {period.company.companyCode} · {period.fiscalYear}/{String(period.fiscalPeriod).padStart(2, '0')}</h2><p className="text-sm text-slate-500">Status {period.status} · Upload {period.uploads[0] ? `v${period.uploads[0].version} (${period.uploads[0].status})` : '—'} · Source reconciliation {['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status) ? 'RECONCILED' : 'PENDING'}</p></div>{eligible && <CalculationButton periodId={period.id} rerun={period.status === 'CALCULATED'} />}</div>
        {run && <div className="mt-5 space-y-4"><div className="grid gap-3 sm:grid-cols-3">{[['ADUM', 'TOTAL_ADUM'], ['PASAR', 'TOTAL_PASAR'], ['TOTAL', 'TOTAL_COMPANY']].map(([label, code]) => <div key={code} className="rounded-lg bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="font-semibold">Rp {money(result(code))}</p></div>)}</div><p className="text-xs text-slate-500">Run #{run.runNumber} · {run.ruleSetVersion} · {run.completedAt?.toISOString() ?? 'RUNNING'} · {run._count.actualLines} lines</p>
          <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="py-2">Group</th><th>Nature</th><th className="text-right">Amount</th></tr></thead><tbody>{run.results.filter((item) => item.resultType === 'NATURE').map((item) => <tr key={item.id} className="border-b"><td className="py-2">{item.costGroup?.code}</td><td>{item.nature?.name}</td><td className="text-right">{money(item.amount)}</td></tr>)}</tbody></table></div>
          <div className="text-xs text-slate-600">{run.results.filter((item) => item.resultType === 'CONTROL').map((item) => <p key={item.id}>{item.resultCode}: {item.reconciliationStatus} (difference {money(item.reconciliationDifference)})</p>)}</div><p className="text-xs text-slate-500">Snapshot: upload/source state and deterministic mapping records retained on run.</p></div>}
      </article>; })}
    </section>
  );
}
