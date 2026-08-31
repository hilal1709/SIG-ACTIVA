import 'server-only';
import { prisma } from '@/lib/prisma';

// CC derivatif is period-optional because the source did not exist in older historical periods.
// When present it remains persisted as AUDIT_CC_DRV and may contribute through the existing
// Company 2000 SI formula; its absence must not block audit hydration/readiness.
export const REQUIRED_AUDIT_CODES: Record<string, readonly string[]> = {
  '2000': ['AUDIT_SI', 'AUDIT_RINCIAN'],
  '7000': ['AUDIT_GHOPO', 'AUDIT_DERIV', 'AUDIT_RINCIAN', 'AUDIT_SI2000_DRV'],
};

export async function getAuditSnapshotReadiness(uploadId: number, companyCode: string) {
  const rows = await prisma.costSourceRow.findMany({
    where: { uploadId, logicalSourceCode: { startsWith: 'AUDIT_' } },
    select: { logicalSourceCode: true },
    distinct: ['logicalSourceCode'],
  });
  const present = new Set(rows.map((row) => row.logicalSourceCode));
  const required = [...(REQUIRED_AUDIT_CODES[companyCode] ?? [])];
  const missing = required.filter((code) => !present.has(code));
  return { ready: missing.length === 0, required, present: [...present].sort(), missing };
}
