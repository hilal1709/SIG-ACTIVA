import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { verifySessionToken, getSessionCookieName } from '@/lib/session';
import { canManageHpp } from '@/lib/hpp/access';
import { validateImport, validateSelection, monthRows, planPeriod, decimal, MAX_FILE_BYTES, type ImportWorkbook } from '@/lib/hpp/import-model';
import type { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function reply(body:unknown,status=200){return NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});}
class ImportError extends Error { constructor(message:string,public status:number){super(message);} }
async function actor(req:NextRequest){
  const session=await verifySessionToken(req.cookies.get(getSessionCookieName())?.value);
  if(!session)throw new ImportError('Unauthorized',401);
  if(!canManageHpp(session.role))throw new ImportError('Forbidden',403);
  const user=await prisma.user.findUnique({where:{id:session.uid},select:{id:true,role:true,isApproved:true}});
  if(!user?.isApproved||!canManageHpp(user.role)||user.role!==session.role)throw new ImportError('Forbidden',403);
  return user.id;
}
function sameOrigin(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)throw new ImportError('Invalid origin',403);
}
async function readBody(req:NextRequest):Promise<unknown>{
  if(!req.headers.get('content-type')?.toLowerCase().startsWith('application/json'))throw new ImportError('JSON diperlukan',415);
  const len=Number(req.headers.get('content-length')??0);
  if(len>MAX_FILE_BYTES)throw new ImportError('Data import maksimal 3 MB',413);
  const reader=req.body?.getReader();if(!reader)throw new ImportError('Body kosong',400);
  const chunks:Uint8Array[]=[];let total=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX_FILE_BYTES){await reader.cancel();throw new ImportError('Data import maksimal 3 MB',413);}chunks.push(value);}}
  finally{reader.releaseLock();}
  try{return JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ImportError('JSON tidak valid',400);}
}
async function currentPlans(tx:Prisma.TransactionClient,book:ImportWorkbook,periods:number[]){
  const versions=await tx.hppPeriodVersion.findMany({where:{fiscalYear:book.year,fiscalPeriod:{in:periods},isCurrent:true},select:{id:true,fiscalPeriod:true,revision:true}});
  const all=versions.length?await tx.hppObservation.findMany({where:{periodVersionId:{in:versions.map(v=>v.id)}},select:{periodVersionId:true,materialCode:true,materialName:true,plant:true,cogm:true,deliveryQty:true,currency:true,quantityUnit:true,priceUnit:true},take:120001}):[];
  if(all.length>120000)throw new ImportError('Cakupan versi aktif terlalu besar untuk import ini',413);
  return periods.map(period=>{
    const v=versions.find(x=>x.fiscalPeriod===period);
    const previous=v?all.filter(o=>o.periodVersionId===v.id).map(o=>({materialCode:o.materialCode,materialName:o.materialName,plant:o.plant,cogm:decimal(o.cogm?.toFixed()??null),deliveryQty:decimal(o.deliveryQty?.toFixed()??null),currency:o.currency,quantityUnit:o.quantityUnit,priceUnit:o.priceUnit?.toFixed()??null})):[];
    return planPeriod(period,monthRows(book,period),previous,v?.id??null,v?.revision??null);
  });
}
function handle(e:unknown){
  if(e instanceof ImportError)return reply({error:e.message},e.status);
  if(e&&typeof e==='object'&&'code' in e&&(e.code==='P2034'||e.code==='P2002'))return reply({error:'Versi berubah karena proses lain. Jalankan preview ulang.'},409);
  console.error('[HPP import]',e instanceof Error?e.name:'UnknownError');
  return reply({error:'Database HPP belum tersedia atau proses gagal. Tidak ada publikasi parsial.'},503);
}
export async function GET(req:NextRequest){
  try{
    await actor(req);
    const raw=req.nextUrl.searchParams.get('year');
    if(raw!==null&&(!/^\d{4}$/.test(raw)||Number(raw)<2000||Number(raw)>2100))throw new ImportError('Tahun tidak valid',400);
    const years=await prisma.hppPeriodVersion.findMany({select:{fiscalYear:true},distinct:['fiscalYear'],orderBy:{fiscalYear:'desc'}});
    const year=raw===null?(years[0]?.fiscalYear??null):Number(raw);
    const history=year===null?[]:await prisma.hppPeriodVersion.findMany({where:{fiscalYear:year},orderBy:[{fiscalPeriod:'desc'},{revision:'desc'}],take:501,select:{id:true,fiscalYear:true,fiscalPeriod:true,revision:true,sourceType:true,sourceName:true,sourceSha256:true,correctionNote:true,createdAt:true,publishedAt:true,isCurrent:true,createdBy:{select:{name:true}},_count:{select:{observations:true}}}});
    return reply({year,years:years.map(y=>y.fiscalYear),history:history.slice(0,500),truncated:history.length>500});
  }catch(e){return handle(e);}
}
export async function POST(req:NextRequest){
  try{
    sameOrigin(req);
    const uid=await actor(req);
    const raw=await readBody(req);
    if(!raw||typeof raw!=='object')throw new ImportError('Body tidak valid',400);
    const body=raw as Record<string,unknown>;
    if(body.action!=='preview'&&body.action!=='publish')throw new ImportError('Aksi tidak valid',400);
    let book:ImportWorkbook;
    try{book=validateImport(body.workbook);}catch(e){throw new ImportError(e instanceof Error?e.message:'Data tidak valid',400);}
    if(typeof body.sourceName!=='string'||body.sourceName.length>180||!body.sourceName.toLowerCase().endsWith('.xlsx')||/[\u0000-\u001f\u007f/\\]/.test(body.sourceName))throw new ImportError('Nama file tidak valid',400);
    const sourceName=body.sourceName;
    // Hash of normalized workbook CONTENT, not the original XLSX binary.
    const hash=createHash('sha256').update(JSON.stringify(book)).digest('hex');
    if(body.action==='preview'){
      const periods=await prisma.$transaction(tx=>currentPlans(tx,book,Array.from({length:12},(_,i)=>i+1)),{isolationLevel:'RepeatableRead',timeout:15000});
      return reply({year:book.year,hash,count:book.rows.length,periods});
    }
    if(body.hash!==hash)throw new ImportError('Data berubah. Jalankan preview ulang.',409);
    let selection:ReturnType<typeof validateSelection>;
    try{selection=validateSelection(body.selection);}catch(e){throw new ImportError(e instanceof Error?e.message:'Pilihan tidak valid',400);}
    const correctionNote=typeof body.correctionNote==='string'?body.correctionNote.trim():'';
    if(correctionNote.length>1000)throw new ImportError('Alasan koreksi maksimal 1000 karakter',400);
    const result=await prisma.$transaction(async tx=>{
      // Recheck actor and current revisions within the same transaction as publication.
      const user=await tx.user.findUnique({where:{id:uid},select:{role:true,isApproved:true}});
      if(!user?.isApproved||!canManageHpp(user.role))throw new ImportError('Forbidden',403);
      const plans=await currentPlans(tx,book,selection.map(s=>s.period));
      for(const p of plans){
        if(p.currentId!==selection.find(s=>s.period===p.period)?.currentId)throw new ImportError('Versi berubah. Jalankan preview ulang.',409);
        if(p.action==='blocked'||p.action==='empty')throw new ImportError('Periode '+p.period+' tidak dapat dipublikasikan',400);
        if(p.action==='correction'&&(body.confirmCorrection!==true||correctionNote.length<5))throw new ImportError('Konfirmasi dan alasan koreksi wajib',400);
      }
      const published:{period:number;revision:number;id:number}[]=[];
      const skipped:number[]=[];
      for(const p of plans){
        if(p.action==='unchanged'){skipped.push(p.period);continue;}
        const max=await tx.hppPeriodVersion.aggregate({where:{fiscalYear:book.year,fiscalPeriod:p.period},_max:{revision:true}});
        const revision=(max._max.revision??0)+1;
        const v=await tx.hppPeriodVersion.create({data:{fiscalYear:book.year,fiscalPeriod:p.period,revision,sourceType:'EXCEL_NORMALIZED',sourceName,sourceSha256:hash,createdById:uid,correctionNote:p.action==='correction'?correctionNote:null,isCurrent:false}});
        const rows=monthRows(book,p.period);
        await tx.hppObservation.createMany({data:rows.map(o=>({...o,periodVersionId:v.id}))});
        if(p.currentId!==null){
          const old=await tx.hppPeriodVersion.updateMany({where:{id:p.currentId,isCurrent:true},data:{isCurrent:false}});
          if(old.count!==1)throw new ImportError('Versi berubah. Jalankan preview ulang.',409);
        }
        await tx.hppPeriodVersion.update({where:{id:v.id},data:{isCurrent:true,publishedAt:new Date()}});
        published.push({period:p.period,revision,id:v.id});
      }
      return {year:book.year,published,skipped};
    },{isolationLevel:'Serializable',timeout:30000});
    return reply(result);
  }catch(e){return handle(e);}
}
