import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/session';
import { canManageHpp } from './access';
export class AgentError extends Error { constructor(message:string, public status:number){super(message);} }
export const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
export const secret=()=>randomBytes(32).toString('hex');
export function equalHash(a:string,b:string){return /^[a-f0-9]{64}$/.test(a)&&/^[a-f0-9]{64}$/.test(b)&&timingSafeEqual(Buffer.from(a,'hex'),Buffer.from(b,'hex'));}
export function reply(data:unknown,status=200){return NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}});}
export function fail(e:unknown){
 if(e instanceof AgentError)return reply({error:e.message},e.status);
 const code=e&&typeof e==='object'&&'code' in e?String(e.code):'UNKNOWN';
 if(code==='P2002'||code==='P2034')return reply({error:'Konflik job/versi; refresh dan coba kembali.'},409);
 console.error('[HPP agent]',code);
 return reply({error:'Layanan SAP Sync belum tersedia atau gagal. Periksa migrasi dan log.'},503);
}
export async function body(req:NextRequest){
 if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new AgentError('JSON required',415);
 const stream=req.body?.getReader();if(!stream)throw new AgentError('Empty body',400);
 let size=0;const chunks:Uint8Array[]=[];
 try{while(true){const {done,value}=await stream.read();if(done)break;size+=value.byteLength;if(size>3*1024*1024){await stream.cancel();throw new AgentError('Body too large',413);}chunks.push(value);}}
 finally{stream.releaseLock();}
 try{const v:unknown=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(!v||typeof v!=='object'||Array.isArray(v))throw Error();return v as Record<string,unknown>;}catch{throw new AgentError('Invalid JSON object',400);}
}
export async function user(req:NextRequest,write=false,admin=false){
 if(write&&req.headers.get('origin')!==req.nextUrl.origin)throw new AgentError('Invalid origin',403);
 const s=await verifySessionToken(req.cookies.get(getSessionCookieName())?.value);
 if(!s)throw new AgentError('Unauthorized',401);
 if(!canManageHpp(s.role)||(admin&&s.role!=='ADMIN_SYSTEM'))throw new AgentError('Forbidden',403);
 const u=await prisma.user.findUnique({where:{id:s.uid},select:{id:true,role:true,isApproved:true}});
 if(!u?.isApproved||u.role!==s.role)throw new AgentError('Forbidden',403);
 return u;
}
export async function device(req:NextRequest){
 // No cookie identity and no browser-origin requests on machine route.
 if(req.headers.has('origin')||req.headers.has('sec-fetch-site'))throw new AgentError('Machine endpoint only',403);
 const token=req.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
 if(!token)throw new AgentError('Unauthorized',401);
 const d=await prisma.desktopAgentDevice.findUnique({where:{tokenHash:sha(token)},select:{id:true,revokedAt:true}});
 if(!d||d.revokedAt)throw new AgentError('Unauthorized',401);
 return d.id;
}
