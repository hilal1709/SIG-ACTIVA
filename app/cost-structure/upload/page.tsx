import { getActiveCostCompanies } from '@/lib/cost-structure/master-data';
import UploadWorkspace from './upload-workspace';

export default async function CostStructureUploadPage() {
  const companies=await getActiveCostCompanies();
  return <UploadWorkspace companies={companies.map(c=>({companyCode:c.companyCode,name:c.companyName}))}/>;
}
