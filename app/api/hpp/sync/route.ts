import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { AgentError, body, fail, reply, secret, sha, user } from '@/lib/hpp/agent-server';
import { canPublishSource, validateAgentResult, validatePeriod, validateScope } from '@/lib/hpp/agent-model';
import { decimal, planPeriod } from '@/lib/hpp/import-model';
import type { Prisma } from '@prisma/client';
export const runtime='nodejs';
export const dynamic='force-dynamic';
const deviceSelect={id:true,name:true,createdAt:true,lastSeenAt:true,revokedAt:true} as const;
const jobSelect={id:true,fiscalYear:true,fiscalPeriod:true,baselineId:true,deviceId:true,status:true,sourceMode:true,createdAt:true,startedAt:true,completedAt:true,reviewedAt:true,reviewedById:true,publishedId:true,errorCode:true,leaseUntil:true,requestedById:true} as const;
async function review(tx:Prisma.TransactionClient,id:string){
 const j=await tx.hppSyncJob.findUnique({where:{id}});
 if(!j||j.status!=='REVIEW'||!j.result||!j.resultHash)throw new AgentError('Job belum siap review',409);
 const r=validateAgentResult(j.result,j.fiscalYear,j.fiscalPeriod,validateScope(j.scope));
 if(sha(JSON.stringify(r))!==j.resultHash)throw new AgentError('Hash hasil tidak sesuai',409);
 const current=await tx.hppPeriodVersion.findFirst({where:{fiscalYear:j.fiscalYear,fiscalPeriod:j.fiscalPeriod,isCurrent:true},select:{id:true,revision:true}});
 const prev=current?await tx.hppObservation.findMany({where:{periodVersionId:current.id},take:1001}):[];
 if(prev.length>1000)throw new AgentError('Cakupan periode terlalu besar',413);
 const next=r.rows.map(x=>({materialCode:x.code,materialName:x.name,plant:x.plant,cogm:x.cogm,deliveryQty:x.deliveryQty}));
 const old=prev.map(x=>({materialCode:x.materialCode,materialName:x.materialName,plant:x.plant,cogm:decimal(x.cogm?.toFixed()??null),deliveryQty:decimal(x.deliveryQty?.toFixed()??null),currency:x.currency,quantityUnit:x.quantityUnit,priceUnit:x.priceUnit?.toFixed()??null}));
 const plan=planPeriod(j.fiscalPeriod,next,old,current?.id??null,current?.revision??null);
 return {j,r,next,plan};
}
export async function GET(req:NextRequest){
 try{
  const u=await user(req);
  const id=req.nextUrl.searchParams.get('jobId');
  if(id){const x=await prisma.$transaction(tx=>review(tx,id),{isolationLevel:'RepeatableRead'});return reply({id,hash:x.j.resultHash,mode:x.r.mode,plan:x.plan,rows:x.r.rows});}
  const [devices,jobs]=await Promise.all([prisma.desktopAgentDevice.findMany({select:deviceSelect,orderBy:{createdAt:'desc'},take:100}),prisma.hppSyncJob.findMany({select:jobSelect,orderBy:{createdAt:'desc'},take:100})]);
  return reply({devices,jobs,isAdmin:u.role==='ADMIN_SYSTEM',sapPublishEnabled:process.env.HPP_AGENT_SAP_PUBLISH_ENABLED==='true'});
 }catch(e){return fail(e);}
}
export async function POST(req:NextRequest){
 try{
  const u=await user(req,true),b=await body(req);
  if(b.action==='register'){
   if(u.role!=='ADMIN_SYSTEM')throw new AgentError('Admin only',403);
   if(typeof b.name!=='string'||!b.name.trim()||b.name.trim().length>80||/[\u0000-\u001f\u007f]/.test(b.name))throw new AgentError('Nama device tidak valid',400);
   const token=secret();
   const d=await prisma.desktopAgentDevice.create({data:{id:randomUUID(),name:b.name.trim(),tokenHash:sha(token),createdById:u.id},select:deviceSelect});
   return reply({device:d,token},201);
  }
  if(b.action==='revoke'){
   if(u.role!=='ADMIN_SYSTEM')throw new AgentError('Admin only',403);
   if(typeof b.deviceId!=='string')throw new AgentError('Device required',400);
   const id=b.deviceId,now=new Date();
   await prisma.$transaction(async tx=>{
    const d=await tx.desktopAgentDevice.updateMany({where:{id,revokedAt:null},data:{revokedAt:now}});
    if(d.count!==1)throw new AgentError('Device tidak aktif',409);
    await tx.hppSyncJob.updateMany({where:{deviceId:id,status:{in:['QUEUED','RUNNING','REVIEW']}},data:{status:'CANCELLED',completedAt:now,leaseHash:null,leaseUntil:null,errorCode:'DEVICE_REVOKED'}});
   },{isolationLevel:'Serializable'});
   return reply({ok:true});
  }
  if(b.action==='enqueue'){
   let p;try{p=validatePeriod(b.year,b.period);}catch{throw new AgentError('Periode tidak valid',400);}
   if(typeof b.deviceId!=='string')throw new AgentError('Pilih device',400);
   const deviceId=b.deviceId;
   const job=await prisma.$transaction(async tx=>{
    const d=await tx.$queryRaw<{id:string}[]>`SELECT id FROM desktop_agent_devices WHERE id=${deviceId} AND "revokedAt" IS NULL FOR UPDATE`;
    if(d.length!==1)throw new AgentError('Device tidak aktif',409);
    const baseline=await tx.hppPeriodVersion.findFirst({where:{fiscalYear:p.year,fiscalPeriod:{lte:p.period},isCurrent:true,publishedAt:{not:null}},orderBy:{fiscalPeriod:'desc'},select:{id:true}});
    if(!baseline)throw new AgentError('Belum ada periode acuan pada tahun ini. Publikasikan Excel terlebih dahulu.',409);
    const observations=await tx.hppObservation.findMany({where:{periodVersionId:baseline.id},select:{materialCode:true,materialName:true,plant:true},take:1001});
    const scope=validateScope(observations.map(x=>({code:x.materialCode,name:x.materialName,plant:x.plant})));
    return tx.hppSyncJob.create({data:{id:randomUUID(),fiscalYear:p.year,fiscalPeriod:p.period,baselineId:baseline.id,requestedById:u.id,deviceId,status:'QUEUED',scope:scope as Prisma.InputJsonValue},select:jobSelect});
   },{isolationLevel:'Serializable'});
   return reply({job},201);
  }
  if(typeof b.jobId!=='string')throw new AgentError('Job required',400);
  const id=b.jobId;
  if(b.action==='cancel'){
   const count=await prisma.hppSyncJob.updateMany({where:{id,status:{in:['QUEUED','RUNNING','REVIEW']}},data:{status:'CANCELLED',completedAt:new Date(),reviewedById:u.id,reviewedAt:new Date(),leaseHash:null,leaseUntil:null}});
   if(count.count!==1)throw new AgentError('Job sudah ditutup',409);
   return reply({ok:true});
  }
  if(b.action!=='publish')throw new AgentError('Invalid action',400);
  if(process.env.HPP_AGENT_SAP_PUBLISH_ENABLED!=='true')throw new AgentError('Publikasi SAP belum diaktifkan; validasi pilot terlebih dahulu.',403);
  const result=await prisma.$transaction(async tx=>{
   const approved=await tx.user.findUnique({where:{id:u.id},select:{role:true,isApproved:true}});
   if(!approved?.isApproved||approved.role!==u.role)throw new AgentError('Forbidden',403);
   const {j,r,next,plan}=await review(tx,id);
   if(!canPublishSource(r.mode))throw new AgentError('Data sintetis tidak boleh dipublikasikan',403);
   if(b.confirm!==true||b.hash!==j.resultHash||b.currentId!==plan.currentId)throw new AgentError('Preview berubah; review ulang',409);
   if(plan.action==='blocked'||plan.action==='empty')throw new AgentError('Publikasi diblokir karena cakupan/metadata',409);
   const reason=typeof b.reason==='string'?b.reason.trim():'';
   if(reason.length<5||reason.length>1000)throw new AgentError('Catatan review 5–1000 karakter wajib',400);
   let publishedId=plan.currentId,status='UNCHANGED';
   if(plan.action!=='unchanged'){
    const max=await tx.hppPeriodVersion.aggregate({where:{fiscalYear:j.fiscalYear,fiscalPeriod:j.fiscalPeriod},_max:{revision:true}});
    const version=await tx.hppPeriodVersion.create({data:{fiscalYear:j.fiscalYear,fiscalPeriod:j.fiscalPeriod,revision:(max._max.revision??0)+1,sourceType:'SAP_AGENT',sourceName:'SAP job '+j.id,sourceSha256:j.resultHash,createdById:u.id,correctionNote:reason,isCurrent:false}});
    await tx.hppObservation.createMany({data:next.map(x=>({...x,periodVersionId:version.id}))});
    if(plan.currentId!==null){
     const old=await tx.hppPeriodVersion.updateMany({where:{id:plan.currentId,isCurrent:true},data:{isCurrent:false}});
     if(old.count!==1)throw new AgentError('Versi berubah',409);
    }
    await tx.hppPeriodVersion.update({where:{id:version.id},data:{isCurrent:true,publishedAt:new Date()}});
    publishedId=version.id;status='PUBLISHED';
   }
   const done=await tx.hppSyncJob.updateMany({where:{id,status:'REVIEW',resultHash:j.resultHash},data:{status,publishedId,reviewedAt:new Date(),reviewedById:u.id,leaseHash:null,leaseUntil:null}});
   if(done.count!==1)throw new AgentError('Job berubah',409);
   return {status,publishedId};
  },{isolationLevel:'Serializable',timeout:30000});
  return reply(result);
 }catch(e){return fail(e);}
}
