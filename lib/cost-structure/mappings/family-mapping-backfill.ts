import 'server-only';
import { CostMappingAction, CostPeriodStatus, Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { isMappingBlockingAmount } from '@/lib/cost-structure/reconciliation/money';
import { coaFamilyPrefix, inferFamilyMappingTarget, type FamilyMappingEvidence } from './family-mapping-policy';

const SOURCES_BY_COMPANY: Record<string, string[]> = {
  '2000': ['CC_ADUM', 'CC_PASAR'],
  '7000': ['CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG'],
};

function candidateKey(source: string, coaCode: string) {
  return `${source}\u0000${coaCode}`;
}

/**
 * Creates an exact COA mapping only when its four-digit family has a single,
 * deterministic disposition. Same-company evidence wins. Cross-company evidence is
 * allowed only when the current company has no family evidence and all usable mappings
 * for that same source/family agree on action + Cost Group code + Nature code.
 *
 * Amounts within the Rp1 de-minimis tolerance are deliberately ignored here. They stay
 * visible for audit but do not justify creating a persistent business mapping.
 */
export async function backfillDeterministicFamilyMappings(uploadId: number, userId: number) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(7301, ${uploadId})`;

    const upload = await tx.costUpload.findUnique({
      where: { id: uploadId },
      include: { period: { include: { company: true } }, sourceRows: true },
    });
    if (!upload) throw new Error('Upload tidak ditemukan.');
    if (!upload.isActiveVersion) throw new Error('Family mapping hanya untuk upload aktif.');
    if (upload.period.status === CostPeriodStatus.FINALIZED) throw new Error('Periode FINALIZED tidak dapat diubah.');

    const sources = SOURCES_BY_COMPANY[upload.period.company.companyCode] ?? [];
    if (!sources.length) return { created: 0, skipped: 0, mappingIds: [] as number[] };

    const candidates = new Map<string, {
      source: string;
      coaCode: string;
      description: string;
      total: Prisma.Decimal;
    }>();

    for (const row of upload.sourceRows) {
      if (!sources.includes(row.logicalSourceCode) || !row.coaCodeRaw) continue;
      const family = coaFamilyPrefix(row.coaCodeRaw);
      if (!family) continue;
      const key = candidateKey(row.logicalSourceCode, row.coaCodeRaw);
      const existing = candidates.get(key) ?? {
        source: row.logicalSourceCode,
        coaCode: row.coaCodeRaw,
        description: row.descriptionRaw?.trim() || row.coaCodeRaw,
        total: new Prisma.Decimal(0),
      };
      existing.total = existing.total.add(row.amount ?? 0);
      candidates.set(key, existing);
    }

    for (const [key, item] of [...candidates]) {
      if (!isMappingBlockingAmount(item.total.toString())) candidates.delete(key);
    }
    if (!candidates.size) return { created: 0, skipped: 0, mappingIds: [] as number[] };

    const yearPeriods = await tx.costPeriod.findMany({
      where: {
        companyId: upload.period.companyId,
        fiscalYear: upload.period.fiscalYear,
      },
      include: {
        uploads: {
          where: { isActiveVersion: true },
          include: {
            sourceRows: {
              where: { logicalSourceCode: { in: sources } },
              select: { logicalSourceCode: true, coaCodeRaw: true, amount: true },
            },
          },
        },
      },
      orderBy: { periodStart: 'asc' },
    });

    const occurrence = new Map<string, { earliest: Date | null; touchesFinalized: boolean }>();
    for (const period of yearPeriods) {
      const activeUpload = period.uploads[0];
      if (!activeUpload) continue;
      const totals = new Map<string, Prisma.Decimal>();
      for (const row of activeUpload.sourceRows) {
        if (!row.coaCodeRaw) continue;
        const key = candidateKey(row.logicalSourceCode, row.coaCodeRaw);
        if (!candidates.has(key)) continue;
        totals.set(key, (totals.get(key) ?? new Prisma.Decimal(0)).add(row.amount ?? 0));
      }
      for (const [key, total] of totals) {
        if (!isMappingBlockingAmount(total.toString())) continue;
        const state = occurrence.get(key) ?? { earliest: null, touchesFinalized: false };
        if (period.status === CostPeriodStatus.FINALIZED) state.touchesFinalized = true;
        else if (!state.earliest || period.periodStart < state.earliest) state.earliest = period.periodStart;
        occurrence.set(key, state);
      }
    }

    const familyEvidenceCache = new Map<string, FamilyMappingEvidence[]>();
    const createdIds: number[] = [];
    let skipped = 0;

    for (const [key, item] of candidates) {
      const state = occurrence.get(key);
      if (state?.touchesFinalized) { skipped += 1; continue; }

      let coa = await tx.costCoa.findUnique({ where: { coaCode: item.coaCode } });
      if (!coa) {
        coa = await tx.costCoa.create({
          data: { coaCode: item.coaCode, coaDescription: item.description },
        });
      }

      const exactMappings = await tx.costCoaMapping.findMany({
        where: {
          companyId: upload.period.companyId,
          sourceLogicalCode: item.source,
          coaId: coa.id,
          active: true,
        },
        select: { id: true },
      });
      // Any explicit exact-COA mapping, even a future interval, outranks family inference.
      if (exactMappings.length) { skipped += 1; continue; }

      const family = coaFamilyPrefix(item.coaCode);
      if (!family) { skipped += 1; continue; }
      const familyCacheKey = `${item.source}\u0000${family}`;
      let evidence = familyEvidenceCache.get(familyCacheKey);
      if (!evidence) {
        const mappings = await tx.costCoaMapping.findMany({
          where: {
            sourceLogicalCode: item.source,
            active: true,
            coa: { coaCode: { startsWith: family } },
          },
          include: {
            coa: { select: { coaCode: true } },
            costGroup: true,
            nature: true,
          },
        });
        evidence = mappings
          .filter((mapping) => {
            if (mapping.mappingAction === CostMappingAction.EXCLUDE) return true;
            if (mapping.mappingAction !== CostMappingAction.INCLUDE) return false;
            return Boolean(
              mapping.costGroup?.active &&
              mapping.costGroup.companyId === mapping.companyId &&
              mapping.nature?.active &&
              mapping.nature.calculationType === 'MAPPED' &&
              mapping.nature.costGroupId === mapping.costGroupId
            );
          })
          .map((mapping) => ({
            companyId: mapping.companyId,
            coaCode: mapping.coa.coaCode,
            mappingAction: mapping.mappingAction,
            groupCode: mapping.costGroup?.code ?? null,
            natureCode: mapping.nature?.code ?? null,
          }));
        familyEvidenceCache.set(familyCacheKey, evidence);
      }

      const inferred = inferFamilyMappingTarget(evidence, upload.period.companyId);
      if (!inferred) { skipped += 1; continue; }

      let costGroupId: number | null = null;
      let natureId: number | null = null;
      if (inferred.mappingAction === 'INCLUDE') {
        const group = await tx.costGroup.findFirst({
          where: {
            companyId: upload.period.companyId,
            code: inferred.groupCode ?? undefined,
            active: true,
          },
        });
        if (!group) { skipped += 1; continue; }
        const nature = await tx.costNature.findFirst({
          where: {
            costGroupId: group.id,
            code: inferred.natureCode ?? undefined,
            active: true,
            calculationType: 'MAPPED',
          },
        });
        if (!nature) { skipped += 1; continue; }
        costGroupId = group.id;
        natureId = nature.id;
      }

      const validFrom = state?.earliest ?? upload.period.periodStart;
      const mapping = await tx.costCoaMapping.create({
        data: {
          companyId: upload.period.companyId,
          sourceLogicalCode: item.source,
          coaId: coa.id,
          costGroupId,
          natureId,
          mappingAction: inferred.mappingAction === 'EXCLUDE' ? CostMappingAction.EXCLUDE : CostMappingAction.INCLUDE,
          validFrom,
          validTo: null,
          active: true,
          note: `Auto family mapping ${family}; ${inferred.scope}; ${inferred.evidenceCount} unanimous evidence row(s); ${inferred.mappingAction}:${inferred.groupCode ?? '-'}:${inferred.natureCode ?? '-'}`,
          createdById: userId,
        },
      });
      createdIds.push(mapping.id);

      await tx.costAuditLog.create({
        data: {
          userId,
          periodId: upload.periodId,
          action: 'AUTO_FAMILY_COA_MAPPING',
          entityType: 'CostCoaMapping',
          entityId: String(mapping.id),
          newValueJson: {
            sourceLogicalCode: item.source,
            coaCode: item.coaCode,
            familyPrefix: family,
            evidenceScope: inferred.scope,
            evidenceCount: inferred.evidenceCount,
            mappingAction: inferred.mappingAction,
            costGroupId,
            natureId,
            groupCode: inferred.groupCode,
            natureCode: inferred.natureCode,
            validFrom: validFrom.toISOString(),
            validTo: null,
          } as Prisma.InputJsonValue,
          reason: 'Deterministic four-digit COA family mapping; unanimous evidence only; de-minimis and ambiguous families excluded.',
        },
      });
    }

    return { created: createdIds.length, skipped, mappingIds: createdIds };
  }, { maxWait: 10_000, timeout: 60_000 });
}
