import {NextRequest,NextResponse} from 'next/server'; import {requireCostStructurePrepare} from '@/lib/cost-structure/auth'; import {refreshPeriodReadiness,runPhaseD} from '@/lib/cost-structure/reconciliation/service';

export const maxDuration = 60;

export async function POST(request:NextRequest,{params}:{params:Promise<{id:string}>}){const auth=await requireCostStructurePrepare(request);if('error'in auth)return auth.error;try{const id=Number((await params).id);await runPhaseD(id);const report=await refreshPeriodReadiness(id);return NextResponse.json({sources:report.sources,completeness:report.completeness,blockers:report.blockers,ready:report.ready});}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'Rekonsiliasi gagal.'},{status:400})}}
