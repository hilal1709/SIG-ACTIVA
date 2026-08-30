import { prisma } from '@/lib/prisma';

const money = (value: { toFixed(digits: number): string }) => value.toFixed(2);

export async function getCostStructureDashboard(periodId: number) {
  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: {
      company: { select: { companyCode: true, companyName: true } },
      activeCalculationRun: {
        include: {
          upload: { select: { version: true, originalFileName: true, fileHashSha256: true } },
          results: { include: { costGroup: true, nature: true }, orderBy: [{ costGroup: { displayOrder: 'asc' } }, { nature: { displayOrder: 'asc' } }] },
          actualLines: { include: { costGroup: true, nature: true, coa: true, sourceRow: { select: { logicalSourceCode: true, originalSheetName: true, sourceRowNumber: true } } }, orderBy: { id: 'asc' } },
        },
      },
    },
  });
  if (!period?.activeCalculationRun) return null;
  const run = period.activeCalculationRun;
  const totalCodes = period.company.companyCode === '7000' ? ['TOTAL_HPP', 'TOTAL_ADUM', 'TOTAL_PASAR', 'TOTAL_COMPANY'] : ['TOTAL_ADUM', 'TOTAL_PASAR', 'TOTAL_COMPANY'];
  const totals = Object.fromEntries(run.results.filter((r) => totalCodes.includes(r.resultCode)).map((r) => [r.resultCode, money(r.amount)]));
  const controls = run.results.filter((r) => r.resultType === 'CONTROL').map((r) => ({ code: r.resultCode, status: r.reconciliationStatus, difference: r.reconciliationDifference ? money(r.reconciliationDifference) : null }));
  const natures = run.results.filter((r) => r.resultType === 'NATURE' && r.costGroup && r.nature).map((result) => ({
    groupCode: result.costGroup!.code,
    groupName: result.costGroup!.name,
    natureCode: result.nature!.code,
    natureName: result.nature!.name,
    calculationType: result.nature!.calculationType,
    ruleCode: result.ruleCode ?? result.nature!.ruleCode,
    amount: money(result.amount),
    calculationDetail: result.calculationDetailJson,
    lines: run.actualLines.filter((line) => line.natureId === result.natureId).map((line) => ({
      id: line.id, coa: line.coa?.coaCode ?? null, coaDescription: line.coa?.coaDescription ?? null,
      sourceAmount: line.sourceAmount ? money(line.sourceAmount) : null, adjustmentAmount: money(line.adjustmentAmount), finalAmount: money(line.finalAmount),
      lineType: line.lineType, ruleCode: line.ruleCode, sourceLogicalCode: line.sourceRow?.logicalSourceCode ?? null,
      sourceSheet: line.sourceRow?.originalSheetName ?? null, sourceRow: line.sourceRow?.sourceRowNumber ?? null, sourceReference: line.sourceReferenceJson,
    })),
  }));
  return {
    period: { id: period.id, companyCode: period.company.companyCode, companyName: period.company.companyName, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, status: period.status, finalizedAt: period.finalizedAt?.toISOString() ?? null },
    run: { id: run.id, runNumber: run.runNumber, status: run.status, isActive: run.isActive, ruleSetVersion: run.ruleSetVersion, calculatedAt: run.completedAt?.toISOString() ?? null },
    upload: { version: run.upload.version, fileName: run.upload.originalFileName },
    totals, controls, natures,
  };
}

export async function listDashboardPeriods() {
  return prisma.costPeriod.findMany({ select: { id: true, fiscalYear: true, fiscalPeriod: true, status: true, company: { select: { companyCode: true, companyName: true } } }, orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { company: { companyCode: 'asc' } }] });
}
