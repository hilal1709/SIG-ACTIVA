import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getMateriality } from '@/lib/cost-fluctuation/materiality/service';
import { comparisonType, positiveSafeInteger } from '@/lib/cost-fluctuation/validation';
export async function GET(request: NextRequest) { const auth = await requireCostStructureRead(request); if ('error' in auth) return auth.error; try { const periodId = positiveSafeInteger(request.nextUrl.searchParams.get('periodId'), 'periodId'); const comparison = comparisonType(request.nextUrl.searchParams.get('comparison')); return NextResponse.json(await getMateriality(periodId, comparison)); } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Materiality failed.' }, { status: 400 }); } }
