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
  const periods = await prisma.costPeriod.findMany({
    include: {
      company: true,
      uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 },
      activeCalculationRun: {
        include: {
          results: { include: { costGroup: true, nature: true } },
          _count: { select: { actualLines: true } },
        },
      },
    },
    orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { companyId: 'asc' }],
  });

  return (
    <section className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:p-8">
      <div data-cost-motion>
        <h1 className="text-2xl font-bold tracking-tight">Cost Structure Bulanan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Engine 1 bulanan, hasil calculation, Nature, dan control reconciliation.</p>
      </div>

      {periods.length === 0 && (
        <div data-cost-motion className="rounded-xl border bg-card p-6 text-sm text-muted-foreground shadow-sm">
          Belum ada periode Cost Structure.
        </div>
      )}

      {periods.map((period) => {
        const run = period.activeCalculationRun;
        const result = (code: string) => run?.results.find((item) => item.resultCode === code)?.amount;
        const eligible = period.company.companyCode === '2000' && ['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status);

        return (
          <article
            key={period.id}
            data-cost-motion
            data-cost-hover
            className="rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">Company {period.company.companyCode} · {period.fiscalYear}/{String(period.fiscalPeriod).padStart(2, '0')}</h2>
                <p className="text-sm text-muted-foreground">
                  Status {period.status} · Upload {period.uploads[0] ? `v${period.uploads[0].version} (${period.uploads[0].status})` : '—'} · Source reconciliation {['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status) ? 'RECONCILED' : 'PENDING'}
                </p>
              </div>
              {eligible && <CalculationButton periodId={period.id} rerun={period.status === 'CALCULATED'} />}
            </div>

            {run && (
              <div className="mt-5 space-y-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  {[
                    ['ADUM', 'TOTAL_ADUM'],
                    ['PASAR', 'TOTAL_PASAR'],
                    ['TOTAL', 'TOTAL_COMPANY'],
                  ].map(([label, code]) => (
                    <div key={code} className="rounded-lg border bg-muted/40 p-3 transition-colors hover:bg-muted/60">
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="font-semibold tabular-nums">Rp {money(result(code))}</p>
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">Run #{run.runNumber} · {run.ruleSetVersion} · {run.completedAt?.toISOString() ?? 'RUNNING'} · {run._count.actualLines} lines</p>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40"><tr className="border-b text-left"><th className="p-2">Group</th><th>Nature</th><th className="pr-2 text-right">Amount</th></tr></thead>
                    <tbody>{run.results.filter((item) => item.resultType === 'NATURE').map((item) => <tr key={item.id} className="border-b transition-colors hover:bg-muted/30"><td className="p-2">{item.costGroup?.code}</td><td>{item.nature?.name}</td><td className="pr-2 text-right tabular-nums">{money(item.amount)}</td></tr>)}</tbody>
                  </table>
                </div>

                <div className="rounded-lg bg-muted/30 p-3 text-xs text-muted-foreground">
                  {run.results.filter((item) => item.resultType === 'CONTROL').map((item) => <p key={item.id}>{item.resultCode}: {item.reconciliationStatus} (difference {money(item.reconciliationDifference)})</p>)}
                </div>
                <p className="text-xs text-muted-foreground">Snapshot upload/source state dan deterministic mapping dipertahankan pada setiap run.</p>
              </div>
            )}
          </article>
        );
      })}
    </section>
  );
}
