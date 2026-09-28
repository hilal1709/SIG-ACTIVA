import { cookies } from 'next/headers';
import CostStructureShell from '@/app/components/CostStructureShell';
import { ReviewReadinessPanel } from '@/components/cost-fluctuation/governance/review-readiness-panel';
import { verifyCostStructureReadSession } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName } from '@/lib/session';

export const dynamic='force-dynamic';
export default async function ReviewPage({searchParams}:{searchParams:Promise<{periodId?:string}>}){const cookieStore=await cookies();const user=await verifyCostStructureReadSession(cookieStore.get(getSessionCookieName())?.value);const query=await searchParams;const rows=await prisma.costPeriod.findMany({where:{status:'FINALIZED'},select:{id:true,fiscalYear:true,fiscalPeriod:true,company:{select:{companyCode:true}}},orderBy:[{fiscalYear:'desc'},{fiscalPeriod:'desc'}]});const periods=rows.map(row=>({id:row.id,companyCode:row.company.companyCode,fiscalYear:row.fiscalYear,fiscalPeriod:row.fiscalPeriod}));return <CostStructureShell title="Period Analytical Review" purpose="Maker/checker readiness for materiality and exact-lineage commentary. This does not finalize or reopen Cost Structure."><ReviewReadinessPanel periods={periods} role={user?.role??''} initialPeriodId={query.periodId}/></CostStructureShell>}
