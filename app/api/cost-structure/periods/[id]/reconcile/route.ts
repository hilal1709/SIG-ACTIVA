import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureReview } from '@/lib/cost-structure/auth';
import { reconcileCostStructure } from '@/lib/cost-structure/finalization/service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureReview(request); if ('error' in auth) return auth.error;
  try { return NextResponse.json(await reconcileCostStructure(Number((await params).id), auth.user.uid)); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Reconciliation gagal.' }, { status: 409 }); }
}
