import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseWorkbook } from '@/lib/cost-structure/parsers';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';
import { REQUIRED_AUDIT_CODES } from './readiness';

const AUDIT_PREFIX = 'AUDIT_';

/**
 * One-time maintenance operation for uploads created before audit-only parser persistence existed.
 * It verifies the stored workbook SHA-256, parses it once, then replaces only AUDIT_* rows.
 * Engine 1 rows, mappings, calculation runs/results, and CostPeriod status are never changed.
 *
 * `expectedUploadId` is used by the automatic processing pipeline so a reopened/new upload
 * cannot accidentally hydrate the upload belonging to an older active calculation run.
 * Existing callers may omit it to retain the export-maintenance authoritative-run behavior.
 */
export async function hydrateAuditSnapshot(periodId: number, userId: number, expectedUploadId?: number) {
  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: {
      company: { select: { companyCode: true } },
      activeCalculationRun: { select: { uploadId: true } },
      uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!period) throw new Error('Periode tidak ditemukan.');

  const explicitUpload = expectedUploadId
    ? await prisma.costUpload.findUnique({ where: { id: expectedUploadId } })
    : null;
  if (expectedUploadId && (!explicitUpload || explicitUpload.periodId !== period.id || !explicitUpload.isActiveVersion)) {
    throw new Error('Upload processing tidak lagi merupakan versi aktif periode ini.');
  }

  const activeUploadId = period.activeCalculationRun?.uploadId;
  const upload = explicitUpload ?? (activeUploadId
    ? (period.uploads.find((item) => item.id === activeUploadId) ?? await prisma.costUpload.findUnique({ where: { id: activeUploadId } }))
    : period.uploads[0]);
  if (!upload) throw new Error('Upload authoritative tidak ditemukan.');

  const bytes = await costStructureStorage.download(upload.storageKey);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== upload.fileHashSha256) throw new Error('SHA-256 workbook Storage tidak cocok dengan CostUpload authoritative.');

  const parsed = await parseWorkbook(bytes, period.company.companyCode);
  const auditRows = parsed.rows.filter((row) => row.logicalSourceCode.startsWith(AUDIT_PREFIX));
  const required = REQUIRED_AUDIT_CODES[period.company.companyCode] ?? [];
  const present = new Set<string>(auditRows.map((row) => row.logicalSourceCode));
  const missing = required.filter((code) => !present.has(code));
  if (missing.length) throw new Error(`Workbook authoritative tidak memuat audit snapshot wajib: ${missing.join(', ')}.`);

  await prisma.$transaction(async (tx) => {
    await tx.costSourceRow.deleteMany({ where: { uploadId: upload.id, logicalSourceCode: { startsWith: AUDIT_PREFIX } } });
    const data: Prisma.CostSourceRowCreateManyInput[] = auditRows.map((row) => ({
      uploadId: upload.id,
      logicalSourceCode: row.logicalSourceCode,
      originalSheetName: row.originalSheetName,
      sourceRowNumber: row.sourceRowNumber,
      coaCodeRaw: null,
      coaId: null,
      descriptionRaw: null,
      amountRaw: null,
      amount: null,
      sourceGroupRaw: null,
      rawDataJson: row.rawDataJson,
      mappingStatus: 'AUDIT_ONLY',
    }));
    for (let offset = 0; offset < data.length; offset += 500) await tx.costSourceRow.createMany({ data: data.slice(offset, offset + 500) });
    await tx.costAuditLog.create({
      data: {
        userId,
        periodId,
        action: 'HYDRATE_AUDIT_SOURCE',
        entityType: 'CostUpload',
        entityId: String(upload.id),
        newValueJson: {
          uploadId: upload.id,
          hashVerified: true,
          accountingAmountsChanged: false,
          calculationRunChanged: false,
          auditRowCount: auditRows.length,
          auditSources: [...present].sort(),
        },
        reason: 'Historical upload audit-only worksheet hydration for DB-only Excel export.',
      },
    });
  }, { timeout: 60_000 });

  return { uploadId: upload.id, rowCount: auditRows.length, sources: [...present].sort(), hashVerified: true };
}
