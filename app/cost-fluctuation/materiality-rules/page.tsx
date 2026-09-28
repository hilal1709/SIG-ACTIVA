import CostStructureShell from '@/app/components/CostStructureShell';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { verifyCostStructureReadSession } from '@/lib/cost-structure/auth';
import { getSessionCookieName } from '@/lib/session';
import { GovernancePermissionState } from '@/components/cost-fluctuation/governance/governance-permission-state';
import MaterialityRuleAdmin from './rule-admin';
export default async function Page(){
  const cookieStore=await cookies(); const user=await verifyCostStructureReadSession(cookieStore.get(getSessionCookieName())?.value);
  if(user?.role!=='ADMIN_SYSTEM') return <CostStructureShell title="Materiality Rules" purpose="Governance threshold efektif bertanggal khusus ADMIN_SYSTEM."><GovernancePermissionState>Read-only finance access does not include materiality administration. Ask an ADMIN_SYSTEM to maintain approved rules.</GovernancePermissionState></CostStructureShell>;
  const [companyRows,rules]=await Promise.all([prisma.costCompany.findMany({where:{active:true},select:{id:true,companyCode:true,groups:{where:{active:true},select:{id:true,code:true,name:true},orderBy:{code:'asc'}}},orderBy:{companyCode:'asc'}}),prisma.costMaterialityRule.findMany({include:{company:true,costGroup:true},orderBy:[{companyId:'asc'},{comparisonType:'asc'},{validFrom:'desc'}]})]);
  const companies=companyRows.map(company=>({id:company.id,companyCode:company.companyCode,costGroups:company.groups}));
  const serialized=rules.map(rule=>({...rule,amountThreshold:rule.amountThreshold?.toString()??null,percentThreshold:rule.percentThreshold?.toString()??null,validFrom:rule.validFrom.toISOString(),validTo:rule.validTo?.toISOString()??null}));
  return <CostStructureShell title="Materiality Rules" purpose="Governance threshold efektif bertanggal khusus ADMIN_SYSTEM; histori dipertahankan melalui successor."><MaterialityRuleAdmin masters={companies} initialRules={serialized}/></CostStructureShell>;
}
