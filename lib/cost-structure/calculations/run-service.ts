import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getPhaseDReport } from '@/lib/cost-structure/reconciliation/service';
import { classifySourceRow } from '@/lib/cost-structure/reconciliation/source-control-registry';
import { calculateCompany2000 } from './company-2000';
import { COMPANY_2000_GROUPS, COMPANY_2000_SOURCES, DERIVATIVE_SOURCE_CODES, ENGINE1_2000_RULE_SET_VERSION } from './constants';
import { buildMappingSnapshot } from './snapshot';
import type { ResolvedSourceLine } from './types';

const companySources = new Set<string>(COMPANY_2000_SOURCES);
const ignoredSources = new Set<string>(DERIVATIVE_SOURCE_CODES);
const PERSIST_CHUNK_SIZE = 750;

export class CalculationConflictError extends Error {}

export async function runCostStructureCalculation(periodId: number, startedById: number) {
  const period = await prisma.costPeriod.findUnique({ where: { id: periodId }, select: { company: { select: { companyCode: true } } } });
  if (!period) throw new Error('Periode tidak ditemukan.');
  if (period.company.companyCode === '2000') return runCompany2000Calculation(periodId, startedById);
  if (period.company.companyCode === '7000') {
    throw new Error('Company 7000 source adapter belum tersedia: workbook golden privat tidak ditemukan, sehingga selector HPP/COAL/OA tidak boleh diinventarisasi tanpa bukti.');
  }
  throw new Error(`Company ${period.company.companyCode} tidak didukung Engine 1.`);
}

export async function runCompany2000Calculation(periodId: number, startedById: number) {
  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: { company: true, uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 } },
  });
  if (!period) throw new Error('Periode tidak ditemukan.');
  if (period.company.companyCode !== '2000') throw new Error('Phase E hanya mendukung Company 2000.');
  if (period.status === 'FINALIZED') throw new Error('Periode FINALIZED tidak dapat dihitung ulang.');
  if (!['SOURCE_RECONCILED', 'CALCULATED'].includes(period.status)) throw new Error('Periode belum SOURCE_RECONCILED.');
  const upload = period.uploads[0];
  if (!upload || upload.periodId !== period.id || !upload.isActiveVersion) throw new Error('Upload aktif untuk periode tidak ditemukan.');
  const readiness = await getPhaseDReport(upload.id);
  if (!readiness?.ready) throw new Error(`Phase D readiness gagal: ${readiness?.blockers.join('; ') ?? 'upload tidak ditemukan'}`);

  let run: { id: number; runNumber: number };
  try {
    run = await prisma.$transaction(async (tx) => {
      const running = await tx.costCalculationRun.findFirst({ where: { periodId, status: 'RUNNING' } });
      if (running) throw new CalculationConflictError('Calculation lain sedang berjalan untuk periode ini.');
      const latest = await tx.costCalculationRun.aggregate({ where: { periodId }, _max: { runNumber: true } });
      return tx.costCalculationRun.create({ data: {
        periodId, uploadId: upload.id, runNumber: (latest._max.runNumber ?? 0) + 1, status: 'RUNNING', isActive: false,
        ruleSetVersion: ENGINE1_2000_RULE_SET_VERSION, startedById,
        sourceSnapshotJson: { periodId, companyCode: period.company.companyCode, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, uploadId: upload.id, uploadVersion: upload.version, uploadHash: upload.fileHashSha256, sourceRowCount: readiness.upload.sourceRows.length, reconciliationReady: readiness.ready, sourceControls: readiness.sources.map((source) => ({ logicalSourceCode: source.logicalSourceCode, status: source.status, difference: source.difference })) },
        mappingSnapshotJson: [],
      }, select: { id: true, runNumber: true } });
    });
  } catch (error) {
    if (error instanceof CalculationConflictError || (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')) throw new CalculationConflictError('Calculation request bertabrakan; silakan coba lagi.');
    throw error;
  }

  try {
    const state = await prisma.costPeriod.findUniqueOrThrow({ where: { id: periodId }, include: {
      company: { include: { groups: { where: { active: true, code: { in: [...COMPANY_2000_GROUPS] } }, select: { id: true, code: true } } } },
      uploads: { where: { id: upload.id }, include: { sourceRows: { include: { coa: true }, orderBy: { id: 'asc' } } }, take: 1 },
      adjustments: { include: { costGroup: true, nature: true }, orderBy: { id: 'asc' } },
    } });
    const currentUpload = state.uploads[0];
    if (!currentUpload?.isActiveVersion) throw new Error('Upload menjadi superseded sebelum calculation selesai.');
    const groupIdByCode = new Map(state.company.groups.map((group) => [group.code, group.id]));
    for (const groupCode of COMPANY_2000_GROUPS) if (!groupIdByCode.has(groupCode)) throw new Error(`Cost Group ${groupCode} aktif tidak ditemukan untuk Company 2000.`);

    const candidates = currentUpload.sourceRows.filter((row) => companySources.has(row.logicalSourceCode) && classifySourceRow({ coaCodeRaw: row.coaCodeRaw, descriptionRaw: row.descriptionRaw, amount: row.amount?.toString() ?? null }).kind === 'DETAIL');
    const coaIds = [...new Set(candidates.flatMap((row) => row.coaId ? [row.coaId] : []))];
    const mappings = await prisma.costCoaMapping.findMany({ where: { companyId: state.companyId, sourceLogicalCode: { in: [...COMPANY_2000_SOURCES] }, coaId: { in: coaIds }, active: true, validFrom: { lte: state.periodStart }, OR: [{ validTo: null }, { validTo: { gte: state.periodStart } }] }, include: { costGroup: true, nature: true }, orderBy: { id: 'asc' } });
    const byKey = new Map<string, typeof mappings>();
    for (const mapping of mappings) { const key = `${mapping.sourceLogicalCode}:${mapping.coaId}`; byKey.set(key, [...(byKey.get(key) ?? []), mapping]); }
    const resolved: ResolvedSourceLine[] = candidates.map((row) => {
      const applicable = row.coaId ? byKey.get(`${row.logicalSourceCode}:${row.coaId}`) ?? [] : [];
      const mapping = applicable[0];
      const amount = row.amount ?? new Prisma.Decimal(0);
      if (!row.coaId && !amount.isZero()) throw new Error(`Source row ${row.id} has no CostCoa.`);
      const disposition = !mapping ? 'UNMAPPED' : mapping.mappingAction === 'EXCLUDE' ? 'EXCLUDED' : mapping.mappingAction === 'RECLASS' ? 'RECLASSIFIED' : 'MAPPED';
      return { sourceRowId: row.id, uploadId: currentUpload.id, uploadVersion: currentUpload.version, logicalSourceCode: row.logicalSourceCode, sourceRowNumber: row.sourceRowNumber, coaId: row.coaId ?? 0, coaCode: row.coa?.coaCode ?? row.coaCodeRaw ?? '', amount, disposition, applicableMappingCount: applicable.length, mappingId: mapping?.id, mappingAction: mapping?.mappingAction, costGroupId: mapping?.costGroupId ?? undefined, groupCode: mapping?.costGroup?.code, natureId: mapping?.natureId ?? undefined, natureCode: mapping?.nature?.code, targetActive: Boolean(mapping?.costGroup?.active && mapping?.nature?.active && mapping.costGroup.companyId === state.companyId && mapping.nature.costGroupId === mapping.costGroupId), natureCalculationType: mapping?.nature?.calculationType };
    });
    // Derivative/support rows are deliberately absent from candidates and therefore cannot contribute.
    void ignoredSources;
    const result = calculateCompany2000({ sourceLines: resolved, adjustments: state.adjustments.map((item) => ({ adjustmentId: item.id, costGroupId: item.costGroupId, groupCode: item.costGroup.code, natureId: item.natureId, natureCode: item.nature.code, coaId: item.coaId, amount: item.amount, reason: item.reason, reference: item.reference, targetActive: item.costGroup.active && item.nature.active && item.costGroup.companyId === state.companyId && item.nature.costGroupId === item.costGroupId, natureCalculationType: item.nature.calculationType })) });
    const relevantMappingIds = new Set(resolved.flatMap((line) => line.mappingId ? [line.mappingId] : []));
    const mappingSnapshot = buildMappingSnapshot(mappings.filter((mapping) => relevantMappingIds.has(mapping.id)).map((mapping) => ({ mappingId: mapping.id, companyId: mapping.companyId, sourceLogicalCode: mapping.sourceLogicalCode, coaId: mapping.coaId, mappingAction: mapping.mappingAction, costGroupId: mapping.costGroupId, natureId: mapping.natureId, validFrom: mapping.validFrom, validTo: mapping.validTo, updatedAt: mapping.updatedAt })));

    await prisma.$transaction(async (tx) => {
      const livePeriod = await tx.costPeriod.findUnique({ where: { id: periodId }, select: { status: true } });
      if (!livePeriod || livePeriod.status === 'FINALIZED') throw new Error('Periode tidak lagi eligible untuk calculation.');
      const liveUpload = await tx.costUpload.findUnique({ where: { id: upload.id }, select: { isActiveVersion: true } });
      if (!liveUpload?.isActiveVersion) throw new Error('Upload menjadi superseded sebelum aktivasi run.');
      await tx.costCalculationRun.update({ where: { id: run.id }, data: { mappingSnapshotJson: mappingSnapshot } });
      const actualLineData = result.actualLines.map((line) => ({ calculationRunId: run.id, periodId, costGroupId: line.costGroupId, natureId: line.natureId, coaId: line.coaId, lineType: line.lineType, sourceAmount: line.sourceAmount, adjustmentAmount: line.adjustmentAmount, finalAmount: line.finalAmount, sourceRowId: line.sourceRowId, sourceReferenceJson: line.sourceReference as Prisma.InputJsonValue }));
      for (let offset = 0; offset < actualLineData.length; offset += PERSIST_CHUNK_SIZE) {
        await tx.costActualLine.createMany({ data: actualLineData.slice(offset, offset + PERSIST_CHUNK_SIZE) });
      }
      await tx.costCalculationResult.createMany({ data: [
        ...result.natureTotals.map((item) => ({ calculationRunId: run.id, periodId, costGroupId: item.costGroupId, natureId: item.natureId, resultCode: 'NATURE_TOTAL', resultType: 'NATURE' as const, amount: item.amount })),
        ...COMPANY_2000_GROUPS.map((code) => ({ calculationRunId: run.id, periodId, costGroupId: groupIdByCode.get(code)!, natureId: null, resultCode: `TOTAL_${code}`, resultType: 'TOTAL' as const, amount: result.groupTotals[code] })),
        { calculationRunId: run.id, periodId, costGroupId: null, natureId: null, resultCode: 'TOTAL_COMPANY', resultType: 'TOTAL' as const, amount: result.companyTotal },
        ...result.controls.map((control) => { const groupCode = control.resultCode.startsWith('ADUM_') ? 'ADUM' : 'PASAR'; return { calculationRunId: run.id, periodId, costGroupId: groupIdByCode.get(groupCode)!, natureId: null, resultCode: control.resultCode, resultType: 'CONTROL' as const, amount: control.amount, reconciliationDifference: control.difference, reconciliationStatus: control.difference.isZero() ? 'RECONCILED' : 'NOT_RECONCILED' }; }),
      ] });
      await tx.costCalculationRun.updateMany({ where: { periodId, isActive: true }, data: { isActive: false } });
      await tx.costCalculationRun.update({ where: { id: run.id }, data: { status: 'SUCCESS', isActive: true, completedAt: new Date() } });
      await tx.costPeriod.update({ where: { id: periodId }, data: { activeCalculationRunId: run.id, status: 'CALCULATED' } });
    });
    return { runId: run.id, runNumber: run.runNumber, result };
  } catch (error) {
    await prisma.costCalculationRun.update({ where: { id: run.id }, data: { status: 'FAILED', isActive: false, completedAt: new Date(), errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'Calculation failed.' } }).catch(() => undefined);
    throw error;
  }
}

export async function getCompany2000Calculation(periodId: number) {
  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: {
      company: true,
      uploads: { where: { isActiveVersion: true }, select: { id: true, version: true, status: true }, take: 1 },
      activeCalculationRun: {
        include: {
          results: { include: { costGroup: true, nature: true }, orderBy: [{ resultType: 'asc' }, { resultCode: 'asc' }] },
          _count: { select: { actualLines: true } },
        },
      },
    },
  });
  if (!period) return null;
  const run = period.activeCalculationRun;
  const total = (code: string) => run?.results.find((item) => item.resultCode === code)?.amount.toString() ?? null;
  return { period: { id: period.id, companyCode: period.company.companyCode, fiscalYear: period.fiscalYear, fiscalPeriod: period.fiscalPeriod, status: period.status, activeUpload: period.uploads[0] ?? null }, activeRun: run ? { id: run.id, runNumber: run.runNumber, ruleSetVersion: run.ruleSetVersion, status: run.status, startedAt: run.startedAt, completedAt: run.completedAt, lineCount: run._count.actualLines, sourceSnapshot: run.sourceSnapshotJson, mappingSnapshot: run.mappingSnapshotJson } : null, totals: { HPP: total('TOTAL_HPP'), ADUM: total('TOTAL_ADUM'), PASAR: total('TOTAL_PASAR'), company: total('TOTAL_COMPANY') }, natureTotals: run?.results.filter((item) => item.resultType === 'NATURE').map((item) => ({ group: item.costGroup?.code, natureId: item.natureId, natureCode: item.nature?.code, natureName: item.nature?.name, calculationType: item.nature?.calculationType, ruleCode: item.nature?.ruleCode, amount: item.amount.toString() })) ?? [], controls: run?.results.filter((item) => item.resultType === 'CONTROL').map((item) => ({ resultCode: item.resultCode, amount: item.amount.toString(), difference: item.reconciliationDifference?.toString(), status: item.reconciliationStatus })) ?? [] };
}

export const getCostStructureCalculation = getCompany2000Calculation;
