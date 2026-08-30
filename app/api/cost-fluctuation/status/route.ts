import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';

export async function GET(request: NextRequest) {
  const auth = await requireCostStructureRead(request);
  if ('error' in auth) return auth.error;

  return NextResponse.json({
    success: true,
    module: 'cost-fluctuation',
    phase: 'A',
  });
}
