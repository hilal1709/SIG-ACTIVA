import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import type { AnalysisRepository, PersistedPeriod } from './types';

const include = { company: { select: { companyCode: true } }, activeCalculationRun: { include: { results: { include: { costGroup: true, nature: true } }, actualLines: { include: { coa: true } } } } } as const;
type Loaded = Prisma.CostPeriodGetPayload<{ include: typeof include }> | null;
const map = (period: Loaded): PersistedPeriod | null => period ? ({ id: period.id, companyId: period.companyId, companyCode: period.company.companyCode, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, status: period.status, activeCalculationRunId: period.activeCalculationRunId, activeRun: period.activeCalculationRun ? { id: period.activeCalculationRun.id, periodId: period.activeCalculationRun.periodId, status: period.activeCalculationRun.status, isActive: period.activeCalculationRun.isActive, ruleSetVersion: period.activeCalculationRun.ruleSetVersion, results: period.activeCalculationRun.results, actualLines: period.activeCalculationRun.actualLines } : null }) : null;

export const prismaAnalysisRepository: AnalysisRepository = {
  async findPeriodById(id) { return map(await prisma.costPeriod.findUnique({ where: { id }, include })); },
  async findPeriod(companyId, month) { return map(await prisma.costPeriod.findUnique({ where: { companyId_fiscalYear_fiscalPeriod: { companyId, ...month } }, include })); },
};
