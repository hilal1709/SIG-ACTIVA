import MonthlyPeriodExplorer from '@/components/cost-structure/monthly/monthly-period-explorer';
import type { MonthlyPeriod } from '@/components/cost-structure/monthly/types';
import { prisma } from '@/lib/prisma';

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

  const explorerPeriods: MonthlyPeriod[] = periods.map((period) => ({
    id: period.id,
    companyCode: period.company.companyCode,
    fiscalYear: period.fiscalYear,
    fiscalPeriod: period.fiscalPeriod,
    status: period.status,
    upload: period.uploads[0]
      ? { id: period.uploads[0].id, version: period.uploads[0].version, status: period.uploads[0].status }
      : null,
    run: period.activeCalculationRun
      ? {
          runNumber: period.activeCalculationRun.runNumber,
          status: period.activeCalculationRun.status,
          ruleSetVersion: period.activeCalculationRun.ruleSetVersion,
          completedAt: period.activeCalculationRun.completedAt?.toISOString() ?? null,
          errorMessage: period.activeCalculationRun.errorMessage,
          actualLineCount: period.activeCalculationRun._count.actualLines,
          results: period.activeCalculationRun.results.map((result) => ({
            id: result.id,
            resultType: result.resultType,
            resultCode: result.resultCode,
            amount: result.amount.toString(),
            reconciliationStatus: result.reconciliationStatus,
            reconciliationDifference: result.reconciliationDifference?.toString() ?? null,
            costGroupCode: result.costGroup?.code ?? null,
            natureName: result.nature?.name ?? null,
            natureCode: result.nature?.code ?? null,
            natureCalculationType: result.nature?.calculationType ?? null,
          })),
        }
      : null,
  }));

  return (
    <section className="mx-auto min-w-0 max-w-7xl space-y-5 p-4 sm:p-6 lg:p-8">
      <div data-cost-motion>
        <h1 className="text-2xl font-bold tracking-tight">Cost Structure Bulanan</h1>
        <p className="mt-1 text-sm text-muted-foreground">Jelajahi hasil Engine 1 bulanan berdasarkan company, tahun, dan periode.</p>
      </div>
      <MonthlyPeriodExplorer periods={explorerPeriods} />
    </section>
  );
}
