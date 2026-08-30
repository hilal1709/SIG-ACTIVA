import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';
import { parseWorkbook } from '@/lib/cost-structure/parsers';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';
import { COST_UPLOAD_STATUSES, MAX_WORKBOOK_BYTES, verifyPendingUpload } from '@/lib/cost-structure/uploads';
import { completeStoredUpload, DuplicateUploadError, UploadCompletionStageError } from '@/lib/cost-structure/completion-service';

export async function POST(request: NextRequest) {
  const auth=await requireCostStructurePrepare(request); if('error' in auth) return auth.error;
  const body=await request.json().catch(()=>null) as {uploadContext?:string}|null; const pending=body?.uploadContext?verifyPendingUpload(body.uploadContext):null;
  if(!pending||pending.userId!==auth.user.uid) return NextResponse.json({error:'Konteks upload tidak valid atau kedaluwarsa.'},{status:400});
  if(pending.fileSize<=0||pending.fileSize>MAX_WORKBOOK_BYTES) return NextResponse.json({error:'Ukuran file tidak valid.'},{status:400});
  const period=await prisma.costPeriod.findUnique({where:{companyId_fiscalYear_fiscalPeriod:{companyId:pending.companyId,fiscalYear:pending.fiscalYear,fiscalPeriod:pending.fiscalPeriod}}});
  if(!period) return NextResponse.json({error:'Periode upload tidak ditemukan.'},{status:400});
  try {
    const completed=await completeStoredUpload({periodId:period.id,objectKey:pending.objectKey,expectedSize:pending.fileSize,companyCode:pending.companyCode},{download:key=>costStructureStorage.download(key),remove:key=>costStructureStorage.remove(key),findDuplicate:(periodId,hash)=>prisma.costUpload.findUnique({where:{periodId_fileHashSha256:{periodId,fileHashSha256:hash}},select:{id:true,version:true,status:true,uploadedAt:true,storageKey:true}}),parse:parseWorkbook,persistAtomically:async({hash,bytes,parsed})=>prisma.$transaction(async(tx)=>{
      const hasErrors=parsed.issues.some(i=>i.severity==='ERROR');
      const latest=await tx.costUpload.aggregate({where:{periodId:period.id},_max:{version:true}}); const version=(latest._max.version||0)+1;
      const created=await tx.costUpload.create({data:{periodId:period.id,version,originalFileName:pending.fileName,fileHashSha256:hash,fileSizeBytes:BigInt(bytes.byteLength),storageProvider:'SUPABASE_STORAGE',storageKey:pending.objectKey,uploadNote:pending.uploadNote,status:hasErrors?COST_UPLOAD_STATUSES.VALIDATION_FAILED:COST_UPLOAD_STATUSES.VALIDATED,isActiveVersion:false,uploadedById:auth.user.uid,validatedAt:new Date()}});
      for(let offset=0;offset<parsed.rows.length;offset+=500) await tx.costSourceRow.createMany({data:parsed.rows.slice(offset,offset+500).map(row=>({...row,uploadId:created.id,amount:row.amount?new Prisma.Decimal(row.amount):null,mappingStatus:'UNMAPPED',rawDataJson:row.rawDataJson}))});
      for(let offset=0;offset<parsed.issues.length;offset+=500) await tx.costValidationIssue.createMany({data:parsed.issues.slice(offset,offset+500).map(issue=>({uploadId:created.id,issueCode:issue.issueCode,severity:issue.severity,message:issue.message}))});
      await tx.costUpload.updateMany({where:{periodId:period.id,isActiveVersion:true},data:{isActiveVersion:false,supersededAt:new Date()}});
      await tx.costUpload.update({where:{id:created.id},data:{isActiveVersion:true}});
      await tx.costPeriod.update({where:{id:period.id},data:{status:'SOURCE_VALIDATION'}});
      return created;
    },{timeout:60_000})});
    const hasErrors=completed.parsed.issues.some(i=>i.severity==='ERROR');
    return NextResponse.json({success:true,upload:{id:completed.result.id,version:completed.result.version,status:hasErrors?COST_UPLOAD_STATUSES.VALIDATION_FAILED:COST_UPLOAD_STATUSES.VALIDATED,hash:completed.hash,rowCount:completed.parsed.rows.length,sources:completed.parsed.sources,issueCount:completed.parsed.issues.length,issues:completed.parsed.issues.slice(0,50)}});
  } catch(error){
    if(error instanceof DuplicateUploadError){const existing=error.existingUpload as {storageKey?:string}&Record<string,unknown>;const {storageKey,...safe}=existing;void storageKey;return NextResponse.json({error:error.message,existingUpload:safe},{status:409});}
    if(error instanceof UploadCompletionStageError){
      console.error('Cost upload completion failed',{stage:error.stage,cause:error.causeError});
      const status=error.stage==='SIZE_VERIFY'||error.stage==='PARSE'?422:500;
      return NextResponse.json({error:error.message,errorCode:`UPLOAD_${error.stage}_FAILED`},{status});
    }
    console.error('Cost upload completion failed',error);
    return NextResponse.json({error:'Gagal memproses workbook; versi sebelumnya tetap aktif.',errorCode:'UPLOAD_UNKNOWN_FAILED'},{status:500});
  }
}
