import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth=await requireCostStructureRead(request); if('error' in auth) return auth.error;
  const limit=Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit'))||20,1),100);
  const uploads=await prisma.costUpload.findMany({take:limit,orderBy:{uploadedAt:'desc'},include:{period:{include:{company:{select:{companyCode:true}}}},uploadedBy:{select:{name:true}},validationIssues:{select:{severity:true}},sourceRows:{select:{logicalSourceCode:true}}}});
  return NextResponse.json({uploads:uploads.map(u=>({id:u.id,companyCode:u.period.company.companyCode,fiscalYear:u.period.fiscalYear,fiscalPeriod:u.period.fiscalPeriod,version:u.version,originalFileName:u.originalFileName,fileSizeBytes:u.fileSizeBytes.toString(),fileHashSha256:u.fileHashSha256,status:u.status,isActiveVersion:u.isActiveVersion,uploadedBy:u.uploadedBy.name,uploadedAt:u.uploadedAt,validatedAt:u.validatedAt,issueSummary:Object.groupBy(u.validationIssues,i=>i.severity),logicalSources:[...new Set(u.sourceRows.map(r=>r.logicalSourceCode))]}))});
}
