import { prisma } from '@/lib/prisma';
import type { ReadinessRepository } from './service';

export const prismaReadinessRepository: ReadinessRepository = {
  async findAll() {
    return prisma.costPeriod.findMany({
      select: { id: true, companyId: true, fiscalYear: true, fiscalPeriod: true, status: true, activeCalculationRunId: true, company: { select: { companyCode: true } }, activeCalculationRun: { select: { id: true, periodId: true, status: true, isActive: true, ruleSetVersion: true } } },
      orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { id: 'desc' }],
    }).then((rows) => rows.map((row) => ({ ...row, companyCode: row.company.companyCode, activeRun: row.activeCalculationRun })));
  },
};
