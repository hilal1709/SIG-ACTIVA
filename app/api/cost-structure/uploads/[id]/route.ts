import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureAdmin, requireCostStructureRead } from '@/lib/cost-structure/auth';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';
import { ARCHIVED_UPLOAD_STATUS, evaluateUploadLifecycle, UPLOAD_LINEAGE_MAPPING_ACTIONS } from '@/lib/cost-structure/upload-lifecycle-policy';
import { prisma } from '@/lib/prisma';

class UploadLifecycleConflict extends Error {}

function parseId(value: string) {
  const id=Number(value);
  return Number.isInteger(id)&&id>0?id:null;
}

function policyInput(upload: {
  status:string;
  isActiveVersion:boolean;
  period:{status:string;_count:{calculationRuns:number};auditLogs:{id:number}[]};
  _count:{adjustments:number};
}) {
  return {
    periodStatus:upload.period.status,
    uploadStatus:upload.status,
    isActiveVersion:upload.isActiveVersion,
    periodCalculationRunCount:upload.period._count.calculationRuns,
    periodMappingMutationCount:upload.period.auditLogs.length,
    uploadAdjustmentCount:upload._count.adjustments,
  };
}

const lifecycleInclude = {
  period:{include:{
    _count:{select:{calculationRuns:true}},
    auditLogs:{where:{action:{in:[...UPLOAD_LINEAGE_MAPPING_ACTIONS]}},select:{id:true}},
  }},
  _count:{select:{adjustments:true}},
} as const;

export async function GET(request:NextRequest,{params}:{params:Promise<{id:string}>}){
  const auth=await requireCostStructureRead(request);if('error'in auth)return auth.error;
  const id=Number((await params).id),page=Math.max(Number(request.nextUrl.searchParams.get('page'))||1,1),pageSize=Math.min(Math.max(Number(request.nextUrl.searchParams.get('pageSize'))||50,1),200);
  if(!Number.isInteger(id))return NextResponse.json({error:'ID tidak valid.'},{status:400});
  const upload=await prisma.costUpload.findUnique({where:{id},include:{period:{include:{company:{select:{companyCode:true}}}},uploadedBy:{select:{name:true}},validationIssues:{orderBy:{createdAt:'asc'}},sourceRows:{skip:(page-1)*pageSize,take:pageSize,orderBy:{id:'asc'},select:{id:true,logicalSourceCode:true,originalSheetName:true,sourceRowNumber:true,coaCodeRaw:true,descriptionRaw:true,amountRaw:true,amount:true,mappingStatus:true}}}});
  if(!upload)return NextResponse.json({error:'Upload tidak ditemukan.'},{status:404});
  const grouped=await prisma.costSourceRow.groupBy({by:['logicalSourceCode','originalSheetName'],where:{uploadId:id},_count:{_all:true}});
  const safeUpload:Partial<typeof upload>={...upload};delete safeUpload.storageKey;
  return NextResponse.json({upload:{...safeUpload,fileSizeBytes:upload.fileSizeBytes.toString(),sourceRows:upload.sourceRows.map(r=>({...r,amount:r.amount?.toString()??null}))},sourceSummary:grouped.map(g=>({logicalSourceCode:g.logicalSourceCode,originalSheetName:g.originalSheetName,rowCount:g._count._all})),pagination:{page,pageSize}});
}

export async function DELETE(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireCostStructureAdmin(request); if('error' in auth) return auth.error;
  const id=parseId((await params).id); if(!id) return NextResponse.json({error:'ID upload tidak valid.'},{status:400});

  const snapshot=await prisma.costUpload.findUnique({where:{id},include:lifecycleInclude});
  if(!snapshot) return NextResponse.json({error:'Upload tidak ditemukan.'},{status:404});
  const initialPolicy=evaluateUploadLifecycle(policyInput(snapshot));
  if(!initialPolicy.canDelete) return NextResponse.json({error:initialPolicy.deleteReason},{status:409});
  if(snapshot.storageProvider!=='SUPABASE_STORAGE') return NextResponse.json({error:'Storage provider upload ini belum mendukung penghapusan aman.'},{status:409});

  try {
    const deleted=await prisma.$transaction(async(tx)=>{
      const upload=await tx.costUpload.findUnique({where:{id},include:lifecycleInclude});
      if(!upload) throw new UploadLifecycleConflict('Upload tidak ditemukan.');
      const policy=evaluateUploadLifecycle(policyInput(upload));
      if(!policy.canDelete) throw new UploadLifecycleConflict(policy.deleteReason||'Upload tidak dapat dihapus.');

      const previous=upload.isActiveVersion?await tx.costUpload.findFirst({where:{periodId:upload.periodId,id:{not:id},status:{not:ARCHIVED_UPLOAD_STATUS}},orderBy:{version:'desc'},select:{id:true,version:true,status:true}}):null;
      await tx.costAuditLog.create({data:{
        userId:auth.user.uid,periodId:upload.periodId,action:'DELETE_COST_UPLOAD',entityType:'CostUpload',entityId:String(upload.id),
        oldValueJson:{version:upload.version,originalFileName:upload.originalFileName,fileHashSha256:upload.fileHashSha256,status:upload.status,isActiveVersion:upload.isActiveVersion,fileSizeBytes:upload.fileSizeBytes.toString()},
        newValueJson:{deleted:true,reactivatedUploadId:previous?.id??null},
        reason:'Admin hard delete before reusable mapping or calculation lineage existed for the period.',
      }});
      await tx.costUpload.delete({where:{id}});
      if(upload.isActiveVersion){
        if(previous){
          await tx.costUpload.update({where:{id:previous.id},data:{isActiveVersion:true,supersededAt:null}});
          await tx.costPeriod.update({where:{id:upload.periodId},data:{status:'SOURCE_VALIDATION'}});
        }else{
          await tx.costPeriod.update({where:{id:upload.periodId},data:{status:'NOT_STARTED'}});
        }
      }
      return {periodId:upload.periodId,storageKey:upload.storageKey,reactivatedUploadId:previous?.id??null};
    });

    let storageRemoved=true;
    try { await costStructureStorage.remove(deleted.storageKey); }
    catch(error){
      storageRemoved=false;
      console.error('Cost upload storage cleanup failed after DB delete',{uploadId:id,error});
      await prisma.costAuditLog.create({data:{
        userId:auth.user.uid,periodId:deleted.periodId,action:'DELETE_COST_UPLOAD_STORAGE_CLEANUP_FAILED',entityType:'CostUpload',entityId:String(id),
        newValueJson:{databaseDeleted:true,storageRemoved:false},
        reason:error instanceof Error?error.message:'Storage cleanup failed after database delete.',
      }}).catch(()=>undefined);
    }
    return NextResponse.json({success:true,deletedUploadId:id,reactivatedUploadId:deleted.reactivatedUploadId,storageRemoved});
  }catch(error){
    if(error instanceof UploadLifecycleConflict) return NextResponse.json({error:error.message},{status:error.message==='Upload tidak ditemukan.'?404:409});
    console.error('Cost upload delete failed',error);
    return NextResponse.json({error:'Gagal menghapus upload. Tidak ada perubahan parsial yang diterapkan ke database.'},{status:500});
  }
}

export async function PATCH(request: NextRequest,{params}:{params:Promise<{id:string}>}) {
  const auth=await requireCostStructureAdmin(request); if('error' in auth) return auth.error;
  const id=parseId((await params).id); if(!id) return NextResponse.json({error:'ID upload tidak valid.'},{status:400});
  const body=await request.json().catch(()=>null) as {action?:string}|null;
  if(body?.action!=='ARCHIVE') return NextResponse.json({error:'Action lifecycle tidak valid.'},{status:400});

  try{
    const archived=await prisma.$transaction(async(tx)=>{
      const upload=await tx.costUpload.findUnique({where:{id},include:lifecycleInclude});
      if(!upload) throw new UploadLifecycleConflict('Upload tidak ditemukan.');
      const policy=evaluateUploadLifecycle(policyInput(upload));
      if(!policy.canArchive) throw new UploadLifecycleConflict(policy.archiveReason||'Upload tidak dapat diarsipkan.');
      await tx.costUpload.update({where:{id},data:{status:ARCHIVED_UPLOAD_STATUS}});
      await tx.costAuditLog.create({data:{
        userId:auth.user.uid,periodId:upload.periodId,action:'ARCHIVE_COST_UPLOAD',entityType:'CostUpload',entityId:String(upload.id),
        oldValueJson:{status:upload.status,isActiveVersion:upload.isActiveVersion,version:upload.version,originalFileName:upload.originalFileName},
        newValueJson:{status:ARCHIVED_UPLOAD_STATUS,isActiveVersion:false},
        reason:'Admin archived a superseded upload; source rows, workbook storage, and financial lineage are retained.',
      }});
      return upload.id;
    });
    return NextResponse.json({success:true,archivedUploadId:archived});
  }catch(error){
    if(error instanceof UploadLifecycleConflict) return NextResponse.json({error:error.message},{status:error.message==='Upload tidak ditemukan.'?404:409});
    console.error('Cost upload archive failed',error);
    return NextResponse.json({error:'Gagal mengarsipkan upload.'},{status:500});
  }
}
