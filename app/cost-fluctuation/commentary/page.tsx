import { cookies } from 'next/headers';
import CostStructureShell from '@/app/components/CostStructureShell';
import GovernanceWorkspace from '@/components/cost-fluctuation/governance/governance-workspace';
import { verifyCostStructureReadSession } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function CommentaryGovernancePage() {
  const cookieStore = await cookies();
  const user = await verifyCostStructureReadSession(cookieStore.get(getSessionCookieName())?.value);
  const rows = await prisma.costPeriod.findMany({
    where: { status: 'FINALIZED' },
    select: { id: true, fiscalYear: true, fiscalPeriod: true, company: { select: { companyCode: true } } },
    orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { id: 'desc' }],
  });
  const periods = rows.map((row) => ({ id: row.id, companyCode: row.company.companyCode, fiscalYear: row.fiscalYear, fiscalPeriod: row.fiscalPeriod }));
  return <CostStructureShell title="Commentary Fluktuasi" purpose="Maker/checker commentary untuk analytical target yang material pada exact Engine 2 lineage.">
    <GovernanceWorkspace periodOptions={periods} role={user?.role ?? ''} currentUserId={user?.uid} />
  </CostStructureShell>;
}
