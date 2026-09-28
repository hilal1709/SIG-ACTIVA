import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCommentaryOverlay } from '@/lib/cost-fluctuation/commentary/service';
import { buildFluctuationWorkbook } from '@/lib/cost-fluctuation/export/workbook';
import { comparisonType, positiveSafeInteger } from '@/lib/cost-fluctuation/validation';
import { FluctuationIntegrityError } from '@/lib/cost-fluctuation/analysis/snapshot';

export async function GET(request:NextRequest){const auth=await requireCostStructureRead(request);if('error'in auth)return auth.error;try{const periodId=positiveSafeInteger(request.nextUrl.searchParams.get('periodId'),'periodId');const comparison=comparisonType(request.nextUrl.searchParams.get('comparison'));const overlay=await getCommentaryOverlay(periodId,comparison);if(overlay.kind!=='OK'||overlay.status!=='AVAILABLE')return NextResponse.json({error:'Comparison must be AVAILABLE for export.'},{status:409});const workbook=await buildFluctuationWorkbook(overlay,comparison);const buffer=await workbook.xlsx.writeBuffer();return new NextResponse(buffer as BodyInit,{headers:{'content-type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','content-disposition':`attachment; filename="analisis-fluktuasi-${periodId}-${comparison}.xlsx"`}});}catch(error){if(error instanceof FluctuationIntegrityError)return NextResponse.json({error:error.message,code:'FLUCTUATION_INTEGRITY_ERROR'},{status:409});return NextResponse.json({error:error instanceof Error?error.message:'Export failed.'},{status:400});}}
