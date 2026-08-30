import 'server-only';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { parseWorkbook } from '@/lib/cost-structure/parsers';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';

const AUDIT_PREFIX = 'AUDIT_';
const REQUIRED_AUDIT_CODES: Record<string, readonly string[]> = {
  '2000': ['AUDIT_SI', 'AUDIT_RINCIAN'],
  '7000': ['AUDIT_GHOPO', 'AUDIT_DERIV', 'AUDIT_RINCIAN', 'AUDIT_CC_DRV', 'AUDIT_SI2000_DRV'],
};

export async function getAuditSnapshotReadiness(uploadId: number, companyCode: string) {
  const rows = await prisma.costSourceRow.findMany({
    where: { uploadId, logicalSourceCode: { startsWith: AUDIT_PREFIX } },
    select: { logicalSourceCode: true },
    distinct: ['logicalSourceCode'],
  });
  const present = new Set(rows.map((row) => row.logicalSourceCode));
  const required = [...(REQUIRED_AUDIT_CODES[companyCode] ?? [])];
  const missing = required.filter((code) => !present.has(code));
  return { ready: missing.length === 0, required, present: [...present].sort(), missing };
}

/**
 * One-time maintenance operation for uploads created before audit-only parser persistence existed.
 * It verifies the stored workbook SHA-256, parses it once, then replaces only AUDIT_* rows.
 * Engine 1 rows, mappings, calculation runs/results, and CostPeriod status are never changed.
 */
export async function hydrateAuditSnapshot(periodId: number, userId: number) {
  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: {
      company: { select: { companyCode: true } },
      activeCalculationRun: { select: { id: true, uploadId: true } },
      uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  if (!period) throw new Error('Periode tidak ditemukan.');
  const upload = period.activeCalculationRun
    ? period.uploads.find((item) => item.id === period.activeCalculationRun!.uploadId) ?? await prisma.costUpload.findUnique({ where: { id: period.activeCalculationRun.uploadId } })
    : period.uploads[0];
  if (!upload) throw new Error('Upload authoritative tidak ditemukan.');

  const bytes = await costStructureStorage.download(upload.storageKey);
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== upload.fileHashSha256) throw new Error('SHA-256 workbook Storage tidak cocok dengan CostUpload authoritative.');

  const parsed = await parseWorkbook(bytes, period.company.companyCode);
  const auditRows = parsed.rows.filter((row) => row.logicalSourceCode.startsWith(AUDIT_PREFIX));
  const required = REQUIRED_AUDIT_CODES[period.company.companyCode] ?? [];
  const present = new Set(auditRows.map((row) => row.logicalSourceCode));
  const missing = required.filter((code) => !present.has(code));
  if (missing.length) throw new Error(`Workbook authoritative tidak memuat audit snapshot wajib: ${missing.join(', ')}.`);

  await prisma.$transaction(async (tx) => {
    await tx.costSourceRow.deleteMany({ where: { uploadId: upload.id, logicalSourceCode: { startsWith: AUDIT_PREFIX } } });
    for (let offset = 0; offset < auditRows.length; offset += 500) {
      await tx.costSourceRow.createMany({
        data: auditRows.slice(offset, offset + 500).map((row) => ({
          ...row,
          uploadId: upload.id,
          amount: null,
          coaId: null,
          coaCodeRaw: null,
          amountRaw: null,
          descriptionRaw: null,
          sourceGroupRaw: null,
          mappingStatus: 'AUDIT_ONLY',
          rawDataJson: row.rawDataJson as Prisma.InputJsonValue,
        })),
      });
    }
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
