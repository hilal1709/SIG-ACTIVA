import { randomUUID } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare } from '@/lib/cost-structure/auth';
import { prisma } from '@/lib/prisma';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';
import { createStorageKey, sanitizeWorkbookName, signPendingUpload, validateWorkbookDeclaration } from '@/lib/cost-structure/uploads';

export async function POST(request: NextRequest) {
  const auth=await requireCostStructurePrepare(request); if('error' in auth) return auth.error;
  let body: {companyCode?:string;fiscalYear?:number;fiscalPeriod?:number;fileName?:string;fileSize?:number;uploadNote?:string};
  try { body=await request.json(); } catch { return NextResponse.json({error:'Payload tidak valid.'},{status:400}); }
  const year=Number(body.fiscalYear), period=Number(body.fiscalPeriod), current=new Date().getUTCFullYear();
  if(!Number.isInteger(year)||year<current-5||year>current+2||!Number.isInteger(period)||period<1||period>12) return NextResponse.json({error:'Tahun atau periode fiskal tidak valid.'},{status:400});
  const fileName=sanitizeWorkbookName(body.fileName||''); const fileError=validateWorkbookDeclaration(fileName,Number(body.fileSize)); if(fileError) return NextResponse.json({error:fileError},{status:400});
  const company=await prisma.costCompany.findFirst({where:{companyCode:body.companyCode,active:true}}); if(!company) return NextResponse.json({error:'Company tidak aktif atau tidak ditemukan.'},{status:400});
  const periodStart=new Date(Date.UTC(year,period-1,1)), periodEnd=new Date(Date.UTC(year,period,0,23,59,59,999));
  await prisma.costPeriod.upsert({where:{companyId_fiscalYear_fiscalPeriod:{companyId:company.id,fiscalYear:year,fiscalPeriod:period}},create:{companyId:company.id,fiscalYear:year,fiscalPeriod:period,periodStart,periodEnd},update:{}});
  const objectKey=createStorageKey(company.companyCode,year,period,fileName,randomUUID());
  try { const signed=await costStructureStorage.createSignedUpload(objectKey); const uploadContext=signPendingUpload({companyId:company.id,companyCode:company.companyCode,fiscalYear:year,fiscalPeriod:period,fileName,fileSize:Number(body.fileSize),uploadNote:body.uploadNote?.trim().slice(0,1000)||undefined,objectKey,userId:auth.user.uid,expiresAt:Date.now()+10*60_000}); return NextResponse.json({...signed,objectKey,uploadContext,expiresInSeconds:600}); }
  catch(error){console.error('Cost upload init failed',error);return NextResponse.json({error:'Gagal membuat akses upload sementara.'},{status:500});}
}
