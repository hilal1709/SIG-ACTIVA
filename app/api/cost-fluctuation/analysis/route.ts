import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCostFluctuationAnalysis } from '@/lib/cost-fluctuation/analysis/service';
import type { ComparisonType } from '@/lib/cost-fluctuation/analysis/types';

const TYPES = new Set<ComparisonType>(['MOM', 'YOY', 'YTD']);
export async function GET(request: NextRequest) {
  const auth = await requireCostStructureRead(request); if ('error' in auth) return auth.error;
  const periodId = Number(request.nextUrl.searchParams.get('periodId')); const raw = request.nextUrl.searchParams.get('comparison')?.toUpperCase();
  if (!Number.isSafeInteger(periodId) || periodId <= 0 || !raw || !TYPES.has(raw as ComparisonType)) return NextResponse.json({ error: 'periodId must be a positive integer and comparison must be MOM, YOY, or YTD.' }, { status: 400 });
  try {
    const result = await getCostFluctuationAnalysis(periodId, raw as ComparisonType);
    if (result.kind === 'NOT_FOUND') return NextResponse.json({ error: 'Cost period not found.' }, { status: 404 });
    if (result.kind === 'INVALID_CURRENT') return NextResponse.json({ error: 'Current period must be FINALIZED.', status: result.status }, { status: 409 });
    return NextResponse.json(result);
  } catch (error) {
    console.error('Cost fluctuation analysis failed', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Analysis failed.' }, { status: 500 });
  }
}
