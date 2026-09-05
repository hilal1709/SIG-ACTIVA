import 'server-only';
import { CostPeriodStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { previousDay } from './effective-mapping';
import {
  authoritativeBaselineStart,
  canCreatePredecessorInterval,
  isAuthoritativeBaselineCandidate,
} from './authoritative-baseline-policy';

const SOURCES_BY_COMPANY: Record<string, string[]> = {
  '2000': ['CC_ADUM', 'CC_PASAR'],
  '7000': ['CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG'],
};

function key(source: string, coaCode: string) {
  return `${source}\u0000${coaCode}`;
}

function mappingTargetValid(mapping: {
  mappingAction: string;
  costGroupId: number | null;
  natureId: number | null;
  costGroup: { id: number; companyId: number; active: boolean } | null;
  nature: { id: number; costGroupId: number; active: boolean; calculationType: string } | null;
}, companyId: number) {
  if (mapping.mappingAction === 'EXCLUDE') return true;
  return Boolean(
    mapping.costGroupId &&
    mapping.natureId &&
    mapping.costGroup?.active &&
    mapping.costGroup.companyId === companyId &&
    mapping.nature?.active &&
    mapping.nature.calculationType === 'MAPPED' &&
    mapping.nature.costGroupId === mapping.costGroupId
  );
}

/**
 * Creates an explicit predecessor interval only for the locked Jul-2026 golden/reviewed
 * baseline mapping. It never changes the baseline row itself and never guesses a mapping.
 */
export async function backfillAuthoritativeBaselineMappings(uploadId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.costUpload.findUnique({
      where: { id: uploadId },
      include: { period: { include: { company: true } }, sourceRows: true },
    });
    if (!upload) throw new Error('Upload tidak ditemukan.');
    if (!upload.isActiveVersion) throw new Error('Historical mapping backfill hanya untuk upload aktif.');
    if (upload.period.status === CostPeriodStatus.FINALIZED) throw new Error('Periode FINALIZED tidak dapat diubah.');

    const sources = SOURCES_BY_COMPANY[upload.period.company.companyCode] ?? [];
    if (!sources.length) return { created: 0, skipped: 0, mappingIds: [] as number[] };

    const currentKeys = new Map<string, { source: string; coaCode: string }>();
    for (const row of upload.sourceRows) {
      if (!sources.includes(row.logicalSourceCode) || !row.coaCodeRaw || !row.amount || row.amount.isZero()) continue;
      currentKeys.set(key(row.logicalSourceCode, row.coaCodeRaw), { source: row.logicalSourceCode, coaCode: row.coaCodeRaw });
    }
    if (!currentKeys.size) return { created: 0, skipped: 0, mappingIds: [] as number[] };

    const coaCodes = [...new Set([...currentKeys.values()].map((item) => item.coaCode))];
    const coas = await tx.costCoa.findMany({ where: { coaCode: { in: coaCodes } }, select: { id: true, coaCode: true } });
    const coaByCode = new Map(coas.map((coa) => [coa.coaCode, coa]));
    const coaIds = coas.map((coa) => coa.id);
    if (!coaIds.length) return { created: 0, skipped: currentKeys.size, mappingIds: [] as number[] };

    const allMappings = await tx.costCoaMapping.findMany({
      where: {
        companyId: upload.period.companyId,
        sourceLogicalCode: { in: sources },
        coaId: { in: coaIds },
        active: true,
      },
      include: { coa: { select: { coaCode: true } }, costGroup: true, nature: true },
      orderBy: { validFrom: 'asc' },
    });
    const mappingsByKey = new Map<string, typeof allMappings>();
    for (const mapping of allMappings) {
      const itemKey = key(mapping.sourceLogicalCode, mapping.coa.coaCode);
      mappingsByKey.set(itemKey, [...(mappingsByKey.get(itemKey) ?? []), mapping]);
    }

    const baselineStart = authoritativeBaselineStart(upload.period.fiscalYear);
    if (upload.period.periodStart >= baselineStart) return { created: 0, skipped: 0, mappingIds: [] as number[] };

    const yearPeriods = await tx.costPeriod.findMany({
      where: {
        companyId: upload.period.companyId,
        fiscalYear: upload.period.fiscalYear,
        periodStart: { lt: baselineStart },
      },
      include: {
        uploads: {
          where: { isActiveVersion: true },
          include: { sourceRows: { where: { logicalSourceCode: { in: sources } } } },
        },
      },
      orderBy: { periodStart: 'asc' },
    });

    const earliestByKey = new Map<string, Date>();
    const finalizedKeys = new Set<string>();
    for (const period of yearPeriods) {
      const activeUpload = period.uploads[0];
      if (!activeUpload) continue;
      for (const row of activeUpload.sourceRows) {
        if (!row.coaCodeRaw || !row.amount || row.amount.isZero()) continue;
        const itemKey = key(row.logicalSourceCode, row.coaCodeRaw);
        if (!currentKeys.has(itemKey)) continue;
        if (period.status === CostPeriodStatus.FINALIZED) {
          finalizedKeys.add(itemKey);
          continue;
        }
        const existing = earliestByKey.get(itemKey);
        if (!existing || period.periodStart < existing) earliestByKey.set(itemKey, period.periodStart);
      }
    }

    const createdIds: number[] = [];
    let skipped = 0;
    for (const [itemKey, item] of currentKeys) {
      const coa = coaByCode.get(item.coaCode);
      const mappings = mappingsByKey.get(itemKey) ?? [];
      if (!coa || finalizedKeys.has(itemKey)) { skipped += 1; continue; }

      const effectiveNow = mappings.filter(
        (mapping) => mapping.validFrom <= upload.period.periodStart && (mapping.validTo === null || mapping.validTo >= upload.period.periodStart)
      );
      if (effectiveNow.length) continue;

      const baselines = mappings.filter((mapping) => isAuthoritativeBaselineCandidate(mapping, upload.period.fiscalYear));
      if (baselines.length !== 1) { skipped += 1; continue; }
      const baseline = baselines[0];
      if (!mappingTargetValid(baseline, upload.period.companyId)) { skipped += 1; continue; }

      const predecessorFrom = earliestByKey.get(itemKey) ?? upload.period.periodStart;
      if (!canCreatePredecessorInterval(predecessorFrom, baseline.validFrom, mappings)) { skipped += 1; continue; }
      const predecessorTo = previousDay(baseline.validFrom);

      const mapping = await tx.costCoaMapping.create({
        data: {
          companyId: baseline.companyId,
          sourceLogicalCode: baseline.sourceLogicalCode,
          costGroupId: baseline.costGroupId,
          natureId: baseline.natureId,
          coaId: baseline.coaId,
          mappingAction: baseline.mappingAction,
          validFrom: predecessorFrom,
          validTo: predecessorTo,
          note: `Historical predecessor from authoritative baseline mapping ${baseline.id}; exact company/source/COA only`,
          active: true,
          createdById: userId,
        },
      });
      createdIds.push(mapping.id);

      await tx.costAuditLog.create({
        data: {
          userId,
          periodId: upload.periodId,
          action: 'BACKFILL_AUTHORITATIVE_BASELINE_MAPPING',
          entityType: 'CostCoaMapping',
          entityId: String(mapping.id),
          oldValueJson: {
            baselineMappingId: baseline.id,
            baselineValidFrom: baseline.validFrom.toISOString(),
            baselineValidTo: baseline.validTo?.toISOString() ?? null,
            baselineNote: baseline.note,
          } as Prisma.InputJsonValue,
          newValueJson: {
            sourceLogicalCode: baseline.sourceLogicalCode,
            coaCode: item.coaCode,
            mappingAction: baseline.mappingAction,
            costGroupId: baseline.costGroupId,
            natureId: baseline.natureId,
            validFrom: predecessorFrom.toISOString(),
            validTo: predecessorTo.toISOString(),
            copiedFromBaselineMappingId: baseline.id,
          } as Prisma.InputJsonValue,
          reason: 'Controlled same-fiscal-year predecessor copied from locked Jul-2026 golden/reviewed baseline; no nearest-future fallback.',
        },
      });
    }

    return { created: createdIds.length, skipped, mappingIds: createdIds };
  }, { maxWait: 10_000, timeout: 60_000 });
}
