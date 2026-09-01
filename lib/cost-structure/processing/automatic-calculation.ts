import 'server-only';
import { prisma } from '@/lib/prisma';
import { CalculationConflictError, runCostStructureCalculation } from '@/lib/cost-structure/calculations/run-service';

const AUTOMATIC_CALCULATION_LOCK_NAMESPACE = 0x534947; // "SIG"

/**
 * Serializes automatic calculation starts for one period and makes repeated
 * process POSTs idempotent for the exact active upload. Explicit/manual
 * recalculation intentionally remains outside this wrapper.
 */
export async function runAutomaticCostStructureCalculation(periodId: number, uploadId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT pg_advisory_xact_lock(${AUTOMATIC_CALCULATION_LOCK_NAMESPACE}::integer, ${periodId}::integer)`;

    const upload = await tx.costUpload.findUnique({
      where: { id: uploadId },
      select: { periodId: true, isActiveVersion: true },
    });
    if (!upload || upload.periodId !== periodId || !upload.isActiveVersion) {
      throw new CalculationConflictError('Upload automatic calculation tidak lagi aktif untuk periode ini.');
    }

    const period = await tx.costPeriod.findUnique({
      where: { id: periodId },
      select: {
        activeCalculationRun: {
          select: { id: true, runNumber: true, status: true, uploadId: true },
        },
      },
    });
    if (!period) throw new Error('Periode tidak ditemukan.');

    const activeRun = period.activeCalculationRun;
    if (activeRun?.status === 'SUCCESS' && activeRun.uploadId === uploadId) {
      return { runId: activeRun.id, runNumber: activeRun.runNumber, skipped: true as const };
    }

    const running = await tx.costCalculationRun.findFirst({
      where: { periodId, status: 'RUNNING' },
      select: { id: true },
    });
    if (running) throw new CalculationConflictError('Calculation lain sedang berjalan untuk periode ini.');

    const calculation = await runCostStructureCalculation(periodId, userId);
    return { runId: calculation.runId, runNumber: calculation.runNumber, skipped: false as const };
  }, { maxWait: 10_000, timeout: 120_000 });
}
