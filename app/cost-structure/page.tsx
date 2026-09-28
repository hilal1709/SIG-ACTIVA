import CostModuleFrame from '@/app/components/CostModuleFrame';
import { listDashboardPeriods } from '@/lib/cost-structure/dashboard/service';
import CostStructureDashboard from './cost-structure-dashboard';

export default async function CostStructureDashboardPage() {
  const periods = await listDashboardPeriods();
  return (
    <CostModuleFrame title="Dashboard Cost Structure" contentClassName="p-4 sm:p-6 lg:p-8">
      <CostStructureDashboard periods={periods.map((period) => ({ ...period, company: period.company }))} />
    </CostModuleFrame>
  );
}
