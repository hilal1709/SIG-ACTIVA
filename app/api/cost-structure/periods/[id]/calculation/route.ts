import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCostStructureCalculation } from '@/lib/cost-structure/calculations/run-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureRead(request);
  if ('error' in auth) return auth.error;
  const result = await getCostStructureCalculation(Number((await params).id));
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'Periode tidak ditemukan.' }, { status: 404 });
}
