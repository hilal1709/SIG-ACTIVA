import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare } from '@/lib/cost-structure/auth';
import { parseWorkbook } from '@/lib/cost-structure/parsers';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructurePrepare(request);
  if ('error' in auth) return auth.error;

  const uploadId = Number((await params).id);
  if (!Number.isSafeInteger(uploadId) || uploadId <= 0) {
    return NextResponse.json({ error: 'Upload ID tidak valid.' }, { status: 400 });
  }

  const upload = await prisma.costUpload.findUnique({
    where: { id: uploadId },
    include: {
      period: { include: { company: true } },
      calculationRuns: { select: { id: true }, take: 1 },
    },
  });
  if (!upload) return NextResponse.json({ error: 'Upload tidak ditemukan.' }, { status: 404 });
  if (!upload.isActiveVersion) return NextResponse.json({ error: 'Hanya active upload version yang dapat direvalidasi.' }, { status: 409 });
  if (upload.status !== 'VALIDATION_FAILED') return NextResponse.json({ error: 'Revalidation hanya berlaku untuk upload berstatus VALIDATION_FAILED.' }, { status: 409 });
  if (upload.calculationRuns.length > 0) return NextResponse.json({ error: 'Upload yang sudah dipakai calculation run tidak dapat direvalidasi.' }, { status: 409 });

  let bytes: Uint8Array;
  try {
    bytes = await costStructureStorage.download(upload.storageKey);
  } catch (error) {
    console.error('Cost upload revalidation download failed', { uploadId, error });
    return NextResponse.json({ error: 'File sumber tidak dapat dibaca kembali dari Storage.' }, { status: 500 });
  }

  if (BigInt(bytes.byteLength) !== upload.fileSizeBytes) {
    return NextResponse.json({ error: 'Ukuran file di Storage tidak sesuai dengan metadata upload.' }, { status: 409 });
  }
  const hash = createHash('sha256').update(bytes).digest('hex');
  if (hash !== upload.fileHashSha256) {
    return NextResponse.json({ error: 'SHA-256 file di Storage tidak sesuai dengan metadata upload.' }, { status: 409 });
  }

  let parsed: Awaited<ReturnType<typeof parseWorkbook>>;
  try {
    parsed = await parseWorkbook(bytes, upload.period.company.companyCode);
  } catch (error) {
    console.error('Cost upload revalidation parse failed', { uploadId, error });
    return NextResponse.json({ error: 'Workbook tidak dapat dibaca oleh parser terbaru.' }, { status: 422 });
  }

  const hasErrors = parsed.issues.some((issue) => issue.severity === 'ERROR');
  const nextStatus = hasErrors ? 'VALIDATION_FAILED' : 'VALIDATED';

  try {
    await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM cost_uploads WHERE id = ${uploadId} FOR UPDATE`;
      const current = await tx.costUpload.findUnique({
        where: { id: uploadId },
        include: { calculationRuns: { select: { id: true }, take: 1 } },
      });
      if (!current || !current.isActiveVersion || current.status !== 'VALIDATION_FAILED') {
        throw new Error('UPLOAD_REVALIDATION_STATE_CHANGED');
      }
      if (current.calculationRuns.length > 0) throw new Error('UPLOAD_REVALIDATION_HAS_RUN');

      await tx.costValidationIssue.deleteMany({ where: { uploadId } });
      await tx.costSourceRow.deleteMany({ where: { uploadId } });

      for (let offset = 0; offset < parsed.rows.length; offset += 500) {
        await tx.costSourceRow.createMany({
          data: parsed.rows.slice(offset, offset + 500).map((row) => ({
            ...row,
            uploadId,
            amount: row.amount ? new Prisma.Decimal(row.amount) : null,
            mappingStatus: row.logicalSourceCode.startsWith('AUDIT_') ? 'AUDIT_ONLY' : 'UNMAPPED',
            rawDataJson: row.rawDataJson,
          })),
        });
      }
      for (let offset = 0; offset < parsed.issues.length; offset += 500) {
        await tx.costValidationIssue.createMany({
          data: parsed.issues.slice(offset, offset + 500).map((issue) => ({
            uploadId,
            issueCode: issue.issueCode,
            severity: issue.severity,
            message: issue.message,
          })),
        });
      }

      await tx.costUpload.update({
        where: { id: uploadId },
        data: { status: nextStatus, validatedAt: new Date() },
      });
      await tx.costPeriod.update({
        where: { id: upload.periodId },
        data: { status: 'SOURCE_VALIDATION' },
      });
      await tx.costAuditLog.create({
        data: {
          userId: auth.user.uid,
          periodId: upload.periodId,
          action: 'REVALIDATE_COST_UPLOAD',
          entityType: 'CostUpload',
          entityId: String(uploadId),
          oldValueJson: { status: upload.status, fileHashSha256: upload.fileHashSha256 },
          newValueJson: { status: nextStatus, fileHashSha256: upload.fileHashSha256, issueCount: parsed.issues.length, rowCount: parsed.rows.length },
          reason: 'Revalidated existing immutable workbook bytes using the current Cost Structure parser/validation rules.',
        },
      });
    }, { timeout: 60_000 });
  } catch (error) {
    console.error('Cost upload revalidation persist failed', { uploadId, error });
    if (error instanceof Error && error.message === 'UPLOAD_REVALIDATION_STATE_CHANGED') {
      return NextResponse.json({ error: 'Status upload berubah saat revalidation. Muat ulang halaman dan coba lagi.' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'UPLOAD_REVALIDATION_HAS_RUN') {
      return NextResponse.json({ error: 'Upload sudah dipakai calculation run dan tidak dapat direvalidasi.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Hasil revalidation gagal disimpan; data upload sebelumnya tetap dipertahankan.' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    upload: {
      id: uploadId,
      version: upload.version,
      status: nextStatus,
      hash: upload.fileHashSha256,
      rowCount: parsed.rows.length,
      sources: parsed.sources,
      issueCount: parsed.issues.length,
      issues: parsed.issues.slice(0, 50),
    },
  });
}
