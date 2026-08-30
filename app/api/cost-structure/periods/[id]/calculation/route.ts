import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCompany2000Calculation } from '@/lib/cost-structure/calculations/run-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureRead(request);
  if ('error' in auth) return auth.error;
  const result = await getCompany2000Calculation(Number((await params).id));
  return result ? NextResponse.json(result) : NextResponse.json({ error: 'Periode tidak ditemukan.' }, { status: 404 });
}

