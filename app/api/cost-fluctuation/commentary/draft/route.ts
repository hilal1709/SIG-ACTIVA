import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare } from '@/lib/cost-structure/auth';
import { saveDraft } from '@/lib/cost-fluctuation/commentary/service';
import { comparisonType, jsonBody, positiveSafeInteger } from '@/lib/cost-fluctuation/validation';
export async function POST(request: NextRequest) { const auth = await requireCostStructurePrepare(request); if ('error' in auth) return auth.error; try { const body = await jsonBody(request); return NextResponse.json({ commentary: await saveDraft({ periodId: positiveSafeInteger(body.periodId, 'periodId'), comparisonType: comparisonType(body.comparisonType), analysisKey: typeof body.analysisKey === 'string' ? body.analysisKey : '', reason: body.reason }, positiveSafeInteger(auth.user.uid, 'userId')) }, { status: 201 }); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Draft failed.' }, { status: 400 }); } }
