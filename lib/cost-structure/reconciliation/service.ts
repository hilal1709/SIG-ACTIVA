import 'server-only';
import { Prisma, CostPeriodStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { classifySourceRow } from './source-control-registry';
import { reconcileCcGroup } from './reconcile-cc-group';
import { calculateMappingCompleteness } from './mapping-completeness';

const required = (company: string) => company === '7000'
  ? ['CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG']
  : ['CC_ADUM', 'CC_PASAR'];

const sourceControlCodes = ['CC_GROUP_TOTAL_NOT_FOUND', 'CC_GROUP_TOTAL_AMBIGUOUS', 'CC_GROUP_NOT_RECONCILED'];
const mappingIssueCodes = ['UNMAPPED_COA', 'MAPPING_AMBIGUOUS', 'MAPPING_OVERLAP', 'MAPPING_TARGET_INVALID'];
const phaseDCodes = [...sourceControlCodes, ...mappingIssueCodes];
const mappingBlockingCodes = new Set(['MAPPING_AMBIGUOUS', 'MAPPING_OVERLAP', 'MAPPING_TARGET_INVALID']);

async function syncSourceIssue(
  tx: Prisma.TransactionClient,
  uploadId: number,
  source: string,
  code: string | null,
  message: string | null
) {
  const context = `[${source}]`;
  const existing = await tx.costValidationIssue.findMany({
    where: { uploadId, issueCode: { in: sourceControlCodes }, message: { startsWith: context }, resolved: false },
  });

  for (const issue of existing) {
    if (issue.issueCode !== code) {
      await tx.costValidationIssue.update({
        where: { id: issue.id },
        data: { resolved: true, resolutionType: 'CONTROL_RERUN_RESOLVED', resolvedAt: new Date() },
      });
    }
  }
  if (!code || !message) return;

  const same = existing.find((issue) => issue.issueCode === code);
  if (same) {
    await tx.costValidationIssue.update({ where: { id: same.id }, data: { message: `${context} ${message}` } });
  } else {
    await tx.costValidationIssue.create({
      data: { uploadId, issueCode: code, severity: 'ERROR', message: `${context} ${message}` },
    });
  }
}

async function syncMappingIssue(
  tx: Prisma.TransactionClient,
  uploadId: number,
  sourceRowId: number,
  context: string,
  code: string | null,
  severity: 'ERROR' | 'WARNING' = 'ERROR',
  message?: string
) {
  const existing = await tx.costValidationIssue.findMany({
    where: { uploadId, issueCode: { in: mappingIssueCodes }, message: { startsWith: context }, resolved: false },
  });

  for (const issue of existing) {
    if (issue.issueCode !== code) {
      await tx.costValidationIssue.update({
        where: { id: issue.id },
        data: { resolved: true, resolutionType: 'MAPPING_RERUN_RESOLVED', resolvedAt: new Date() },
      });
    }
  }
  if (!code) return;

  const fullMessage = `${context} ${message ?? 'Mapping source memerlukan resolusi.'}`;
  const same = existing.find((issue) => issue.issueCode === code);
  if (same) {
    await tx.costValidationIssue.update({
      where: { id: same.id },
      data: { sourceRowId, severity, message: fullMessage },
    });
  } else {
    await tx.costValidationIssue.create({
      data: { uploadId, sourceRowId, issueCode: code, severity, message: fullMessage },
    });
  }
}

function targetIsValid(
  mapping: {
    mappingAction: string;
    costGroupId: number | null;
    natureId: number | null;
    costGroup: { id: number; companyId: number; active: boolean } | null;
    nature: { id: number; costGroupId: number; active: boolean; calculationType: string } | null;
  },
  companyId: number
) {
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

export async function runPhaseD(uploadId: number) {
  return prisma.$transaction(async (tx) => {
    const upload = await tx.costUpload.findUnique({
      where: { id: uploadId },
      include: { period: { include: { company: true } }, sourceRows: true },
    });
    if (!upload) throw new Error('Upload tidak ditemukan.');
    if (!upload.isActiveVersion) throw new Error('Hanya upload aktif yang dapat direkonsiliasi.');
    if (upload.period.status === CostPeriodStatus.FINALIZED) throw new Error('Periode FINALIZED tidak dapat diubah.');

    const results = [];
    for (const source of required(upload.period.company.companyCode)) {
      const rows = upload.sourceRows.filter((row) => row.logicalSourceCode === source);
      const result = reconcileCcGroup(rows.map((row) => ({
        id: row.id,
        coaCodeRaw: row.coaCodeRaw,
        descriptionRaw: row.descriptionRaw,
        amount: row.amount?.toString() ?? null,
      })));
      results.push({ logicalSourceCode: source, ...result });

      const classified = rows.map((row) => ({
        row,
        kind: classifySourceRow({
          coaCodeRaw: row.coaCodeRaw,
          descriptionRaw: row.descriptionRaw,
          amount: row.amount?.toString() ?? null,
        }).kind,
      }));
      const controlIds = classified.filter((item) => item.kind !== 'DETAIL').map((item) => item.row.id);
      if (controlIds.length) {
        await tx.costSourceRow.updateMany({ where: { id: { in: controlIds } }, data: { mappingStatus: 'CONTROL_ROW' } });
        await tx.costValidationIssue.updateMany({
          where: { sourceRowId: { in: controlIds }, issueCode: 'SOURCE_ROW_MISSING_COA', resolved: false },
          data: { resolved: true, resolutionType: 'AUTO_CLASSIFIED_CONTROL_ROW', resolvedAt: new Date() },
        });
      }

      const detailRows = classified.filter((item) => item.kind === 'DETAIL').map((item) => item.row);
      const rowsByCoa = new Map<string, typeof detailRows>();
      for (const row of detailRows) {
        if (!row.coaCodeRaw) continue;
        rowsByCoa.set(row.coaCodeRaw, [...(rowsByCoa.get(row.coaCodeRaw) ?? []), row]);
      }

      const coaCodes = [...rowsByCoa.keys()];
      const coas = coaCodes.length
        ? await tx.costCoa.findMany({ where: { coaCode: { in: coaCodes } } })
        : [];
      const coaByCode = new Map(coas.map((coa) => [coa.coaCode, coa]));
      const coaIds = coas.map((coa) => coa.id);
      const effectiveMappings = coaIds.length
        ? await tx.costCoaMapping.findMany({
            where: {
              companyId: upload.period.companyId,
              sourceLogicalCode: source,
              coaId: { in: coaIds },
              active: true,
              validFrom: { lte: upload.period.periodStart },
              OR: [{ validTo: null }, { validTo: { gte: upload.period.periodStart } }],
            },
            include: { costGroup: true, nature: true },
          })
        : [];
      const mappingsByCoa = new Map<number, typeof effectiveMappings>();
      for (const mapping of effectiveMappings) {
        mappingsByCoa.set(mapping.coaId, [...(mappingsByCoa.get(mapping.coaId) ?? []), mapping]);
      }

      for (const [coaCode, coaRows] of rowsByCoa) {
        const coa = coaByCode.get(coaCode);
        const mappings = coa ? mappingsByCoa.get(coa.id) ?? [] : [];
        const context = `[${source}:${coaCode}]`;
        const rowIds = coaRows.map((row) => row.id);
        const firstRowId = rowIds[0];

        if (mappings.length === 1 && targetIsValid(mappings[0], upload.period.companyId)) {
          const mapping = mappings[0];
          const status = mapping.mappingAction === 'INCLUDE'
            ? 'MAPPED'
            : mapping.mappingAction === 'EXCLUDE'
              ? 'EXCLUDED'
              : 'RECLASSIFIED';
          await tx.costSourceRow.updateMany({
            where: { id: { in: rowIds } },
            data: { coaId: coa?.id ?? null, mappingStatus: status },
          });
          await syncMappingIssue(tx, uploadId, firstRowId, context, null);
          continue;
        }

        await tx.costSourceRow.updateMany({
          where: { id: { in: rowIds } },
          data: { coaId: coa?.id ?? null, mappingStatus: 'UNMAPPED' },
        });

        const hasNonZero = coaRows.some((row) => row.amount && !row.amount.isZero());
        if (mappings.length > 1) {
          await syncMappingIssue(tx, uploadId, firstRowId, context, 'MAPPING_AMBIGUOUS', 'ERROR', 'Lebih dari satu mapping efektif.');
        } else if (mappings.length === 1) {
          await syncMappingIssue(tx, uploadId, firstRowId, context, 'MAPPING_TARGET_INVALID', 'ERROR', 'Target mapping tidak lagi aktif/valid atau bukan Nature MAPPED.');
        } else {
          await syncMappingIssue(
            tx,
            uploadId,
            firstRowId,
            context,
            'UNMAPPED_COA',
            hasNonZero ? 'ERROR' : 'WARNING',
            'COA belum memiliki disposition eksplisit.'
          );
        }
      }

      const message = result.issueCode === 'CC_GROUP_TOTAL_NOT_FOUND'
        ? 'Reported total unik tidak ditemukan.'
        : result.issueCode === 'CC_GROUP_TOTAL_AMBIGUOUS'
          ? 'Lebih dari satu kandidat reported total ditemukan.'
          : result.issueCode
            ? `Detail ${result.detailAmount} tidak sama dengan reported ${result.reportedAmount}; selisih ${result.difference}.`
            : null;
      await syncSourceIssue(tx, uploadId, source, result.issueCode, message);
    }

    const supportRows = upload.sourceRows.filter(
      (row) => !required(upload.period.company.companyCode).includes(row.logicalSourceCode)
    );
    if (supportRows.length) {
      await tx.costSourceRow.updateMany({
        where: { id: { in: supportRows.map((row) => row.id) } },
        data: { mappingStatus: 'SUPPORT_SOURCE' },
      });
    }
    return results;
  });
}

export async function getPhaseDReport(uploadId: number) {
  const upload = await prisma.costUpload.findUnique({
    where: { id: uploadId },
    include: {
      period: { include: { company: true } },
      sourceRows: true,
      validationIssues: { orderBy: [{ resolved: 'asc' }, { createdAt: 'asc' }] },
    },
  });
  if (!upload) return null;

  const requiredSources = required(upload.period.company.companyCode);
  const sources = requiredSources.map((source) => ({
    logicalSourceCode: source,
    ...reconcileCcGroup(
      upload.sourceRows
        .filter((row) => row.logicalSourceCode === source)
        .map((row) => ({
          coaCodeRaw: row.coaCodeRaw,
          descriptionRaw: row.descriptionRaw,
          amount: row.amount?.toString() ?? null,
        }))
    ),
  }));

  const detail = upload.sourceRows.filter(
    (row) =>
      requiredSources.includes(row.logicalSourceCode) &&
      classifySourceRow({
        coaCodeRaw: row.coaCodeRaw,
        descriptionRaw: row.descriptionRaw,
        amount: row.amount?.toString() ?? null,
      }).kind === 'DETAIL'
  );

  const completeness = calculateMappingCompleteness(detail.map((row) => ({
    logicalSourceCode: row.logicalSourceCode,
    coaCodeRaw: row.coaCodeRaw,
    amount: row.amount?.toString() ?? null,
    mappingStatus: row.mappingStatus,
  })));

  const structuralErrors = upload.validationIssues.filter(
    (issue) => !issue.resolved && issue.severity === 'ERROR' && !phaseDCodes.includes(issue.issueCode)
  );
  const mappingErrors = upload.validationIssues.filter(
    (issue) => !issue.resolved && issue.severity === 'ERROR' && mappingBlockingCodes.has(issue.issueCode)
  );

  const blockers = [
    ...sources.filter((source) => source.status !== 'RECONCILED').map((source) => `${source.logicalSourceCode}: ${source.status}`),
    ...(completeness.unmappedCoaCount ? [`${completeness.unmappedCoaCount} COA non-zero belum memiliki disposition.`] : []),
    ...(completeness.difference !== '0.00' ? [`Mapping completeness difference ${completeness.difference}.`] : []),
    ...mappingErrors.map((issue) => issue.message),
    ...structuralErrors.map((issue) => issue.message),
  ];

  return {
    upload,
    sources,
    completeness,
    blockers,
    ready: upload.isActiveVersion && blockers.length === 0,
  };
}

export async function refreshPeriodReadiness(uploadId: number) {
  const report = await getPhaseDReport(uploadId);
  if (!report) throw new Error('Upload tidak ditemukan.');
  if (report.upload.period.status === 'FINALIZED') throw new Error('Periode FINALIZED tidak dapat diubah.');

  const currentStatus = report.upload.period.status;
  const preserveHigherReadyState = report.ready && ['CALCULATED', 'COST_STRUCTURE_RECONCILED'].includes(currentStatus);
  const nextStatus = report.ready
    ? preserveHigherReadyState ? currentStatus : 'SOURCE_RECONCILED'
    : 'SOURCE_VALIDATION';

  await prisma.costPeriod.update({
    where: { id: report.upload.periodId },
    data: { status: nextStatus },
  });
  return report;
}
