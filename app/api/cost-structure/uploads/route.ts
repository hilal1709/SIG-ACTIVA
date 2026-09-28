import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { ARCHIVED_UPLOAD_STATUS, evaluateUploadLifecycle, UPLOAD_LINEAGE_MAPPING_ACTIONS } from '@/lib/cost-structure/upload-lifecycle-policy';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const auth=await requireCostStructureRead(request); if('error' in auth) return auth.error;
  const limit=Math.min(Math.max(Number(request.nextUrl.searchParams.get('limit'))||20,1),100);
  const includeArchived=request.nextUrl.searchParams.get('includeArchived')==='1';
  const uploads=await prisma.costUpload.findMany({
    where: includeArchived ? undefined : { status: { not: ARCHIVED_UPLOAD_STATUS } },
    take:limit,
    orderBy:{uploadedAt:'desc'},
    include:{
      period:{include:{
        company:{select:{companyCode:true}},
        _count:{select:{calculationRuns:true}},
        auditLogs:{where:{action:{in:[...UPLOAD_LINEAGE_MAPPING_ACTIONS]}},select:{id:true}},
      }},
      uploadedBy:{select:{name:true}},
      validationIssues:{select:{severity:true}},
      sourceRows:{select:{logicalSourceCode:true}},
      _count:{select:{adjustments:true,calculationRuns:true}},
    },
  });
  return NextResponse.json({uploads:uploads.map(u=>{
    const lifecycle=evaluateUploadLifecycle({
      periodStatus:u.period.status,
      uploadStatus:u.status,
      isActiveVersion:u.isActiveVersion,
      periodCalculationRunCount:u.period._count.calculationRuns,
      periodMappingMutationCount:u.period.auditLogs.length,
      uploadAdjustmentCount:u._count.adjustments,
    });
    return {
      id:u.id,companyCode:u.period.company.companyCode,fiscalYear:u.period.fiscalYear,fiscalPeriod:u.period.fiscalPeriod,
      version:u.version,originalFileName:u.originalFileName,fileSizeBytes:u.fileSizeBytes.toString(),fileHashSha256:u.fileHashSha256,
      status:u.status,isActiveVersion:u.isActiveVersion,uploadedBy:u.uploadedBy.name,uploadedAt:u.uploadedAt,validatedAt:u.validatedAt,
      issueSummary:Object.groupBy(u.validationIssues,i=>i.severity),logicalSources:[...new Set(u.sourceRows.map(r=>r.logicalSourceCode))],
      lifecycle,
    };
  })});
}
