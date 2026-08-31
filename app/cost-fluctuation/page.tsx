import CostStructureShell from '@/app/components/CostStructureShell';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCostStructureReadSession } from '@/lib/cost-structure/auth';
import { getSessionCookieName } from '@/lib/session';
import FluctuationWorkflow from './workflow';

export const dynamic = 'force-dynamic';

export default async function CostFluctuationPage() {
  const cookieStore = await cookies();
  const user = await verifyCostStructureReadSession(cookieStore.get(getSessionCookieName())?.value);
  const periods = await prisma.costPeriod.findMany({
    where: { status: 'FINALIZED' },
    select: {
      id: true,
      fiscalYear: true,
      fiscalPeriod: true,
      company: { select: { companyCode: true } },
    },
    orderBy: [{ fiscalYear: 'desc' }, { fiscalPeriod: 'desc' }, { id: 'desc' }],
  });

  const periodOptions = periods.map((period) => ({
    id: period.id,
    companyCode: period.company.companyCode,
    fiscalYear: period.fiscalYear,
    fiscalPeriod: period.fiscalPeriod,
  }));

  return (
    <CostStructureShell title="Analisis Fluktuasi" purpose="Analisis MoM, YoY, dan YTD berdasarkan Cost Structure yang telah difinalisasi.">
      <FluctuationWorkflow periodOptions={periodOptions} role={user?.role ?? ''} />
    </CostStructureShell>
  );
}
