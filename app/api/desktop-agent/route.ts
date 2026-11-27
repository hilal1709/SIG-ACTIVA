import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { AgentError, body, device, equalHash, fail, reply, secret, sha } from '@/lib/hpp/agent-server';
import { AGENT_ERRORS, AGENT_LEASE_MS, leaseValid, validateAgentResult, validateScope } from '@/lib/hpp/agent-model';
import type { Prisma } from '@prisma/client';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export async function POST(req:NextRequest){
 try{
  const id=await device(req), b=await body(req);
  if(b.protocol!==1)throw new AgentError('Unsupported protocol',400);
  const now=new Date();
  if(b.action==='poll'){
   const result=await prisma.$transaction(async tx=>{
    // Lock the device row: revoke and poll/submit are serialized for this device.
    const active=await tx.desktopAgentDevice.updateMany({where:{id,revokedAt:null},data:{lastSeenAt:now}});
    if(active.count!==1)throw new AgentError('Unauthorized',401);
    await tx.hppSyncJob.updateMany({where:{deviceId:id,status:'RUNNING',leaseUntil:{lte:now}},data:{status:'FAILED',errorCode:'LEASE_EXPIRED',completedAt:now,leaseHash:null,leaseUntil:null}});
    if(await tx.hppSyncJob.count({where:{deviceId:id,status:'RUNNING'}}))return {job:null};
    const job=await tx.hppSyncJob.findFirst({where:{deviceId:id,status:'QUEUED'},orderBy:{createdAt:'asc'}});
    if(!job)return {job:null};
    const lease=secret(),until=new Date(now.getTime()+AGENT_LEASE_MS);
    const updated=await tx.hppSyncJob.updateMany({where:{id:job.id,status:'QUEUED'},data:{status:'RUNNING',startedAt:now,leaseHash:sha(lease),leaseUntil:until}});
    if(updated.count!==1)throw new AgentError('Job conflict',409);
    return {job:{id:job.id,kind:'HPP_EXTRACT',parameters:{year:job.fiscalYear,period:job.fiscalPeriod,scope:validateScope(job.scope)},lease,leaseUntil:until.toISOString()}};
   },{isolationLevel:'Serializable'});
   return reply(result);
  }
  if((b.action!=='complete'&&b.action!=='fail')||b.kind!=='HPP_EXTRACT')throw new AgentError('Invalid action or job type',400);
  if(typeof b.jobId!=='string'||typeof b.lease!=='string'||! /^[a-f0-9]{64}$/.test(b.lease))throw new AgentError('Invalid job/lease',400);
  const jobId=b.jobId, lease=b.lease;
  const result=await prisma.$transaction(async tx=>{
   const active=await tx.desktopAgentDevice.updateMany({where:{id,revokedAt:null},data:{lastSeenAt:now}});
   if(active.count!==1)throw new AgentError('Unauthorized',401);
   const job=await tx.hppSyncJob.findFirst({where:{id:jobId,deviceId:id}});
   if(!job||!job.leaseHash||!equalHash(job.leaseHash,sha(lease)))throw new AgentError('Invalid job/lease',409);
   // Retry after a lost response is safe for the same completed payload.
   if(b.action==='complete'&&job.status==='REVIEW'){
    let r;try{r=validateAgentResult(b.result,job.fiscalYear,job.fiscalPeriod,validateScope(job.scope));}catch{throw new AgentError('Invalid result',400);}
    if(sha(JSON.stringify(r))===job.resultHash)return {status:'REVIEW',id:job.id};
   }
   if(!leaseValid(job.status,job.leaseUntil,new Date()))throw new AgentError('Job lease expired or closed',409);
   if(b.action==='fail'){
    if(typeof b.code!=='string'||!AGENT_ERRORS.some(x=>x===b.code))throw new AgentError('Invalid failure code',400);
    const changed=await tx.hppSyncJob.updateMany({where:{id:job.id,status:'RUNNING',leaseHash:job.leaseHash},data:{status:'FAILED',errorCode:b.code,completedAt:now,leaseHash:null,leaseUntil:null}});
    if(changed.count!==1)throw new AgentError('Job conflict',409);
    return {status:'FAILED',id:job.id};
   }
   let result;try{result=validateAgentResult(b.result,job.fiscalYear,job.fiscalPeriod,validateScope(job.scope));}catch(e){throw new AgentError(e instanceof Error?e.message:'Invalid result',400);}
   const changed=await tx.hppSyncJob.updateMany({where:{id:job.id,status:'RUNNING',leaseHash:job.leaseHash},data:{status:'REVIEW',result:result as Prisma.InputJsonValue,resultHash:sha(JSON.stringify(result)),sourceMode:result.mode,completedAt:now,leaseUntil:null}});
   if(changed.count!==1)throw new AgentError('Job conflict',409);
   return {status:'REVIEW',id:job.id};
  },{isolationLevel:'Serializable',timeout:15000});
  return reply(result);
 }catch(e){return fail(e);}
}
