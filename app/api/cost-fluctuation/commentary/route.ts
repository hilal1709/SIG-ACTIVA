import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCommentaryOverlay } from '@/lib/cost-fluctuation/commentary/service';
import { comparisonType, positiveSafeInteger } from '@/lib/cost-fluctuation/validation';
import { FluctuationIntegrityError } from '@/lib/cost-fluctuation/analysis/snapshot';
export async function GET(request: NextRequest) { const auth = await requireCostStructureRead(request); if ('error' in auth) return auth.error; try { return NextResponse.json(await getCommentaryOverlay(positiveSafeInteger(request.nextUrl.searchParams.get('periodId'), 'periodId'), comparisonType(request.nextUrl.searchParams.get('comparison')))); } catch (error) { if (error instanceof FluctuationIntegrityError) return NextResponse.json({ error: error.message, code: 'FLUCTUATION_INTEGRITY_ERROR' }, { status: 409 }); return NextResponse.json({ error: error instanceof Error ? error.message : 'Commentary query failed.' }, { status: 400 }); } }
