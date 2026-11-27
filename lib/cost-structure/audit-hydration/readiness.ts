import 'server-only';
import { prisma } from '@/lib/prisma';

// CC derivatif is period-optional because the source did not exist in older historical periods.
// Company 7000 also predates the GHoPO + DERIV split: older workbooks use one `SI` summary,
// persisted by the parser as AUDIT_GHOPO with originalSheetName=`SI`. Therefore hydration only
// requires the stable Company-7000 summary plus Rincian. DERIV/SI2000_DRV remain downstream
// optional sources and must never be fabricated when they did not exist in the authoritative file.
export const REQUIRED_AUDIT_CODES: Record<string, readonly string[]> = {
  '2000': ['AUDIT_SI', 'AUDIT_RINCIAN'],
  '7000': ['AUDIT_GHOPO', 'AUDIT_RINCIAN'],
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
