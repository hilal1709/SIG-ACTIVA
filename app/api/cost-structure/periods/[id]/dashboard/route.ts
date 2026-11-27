import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { getCostStructureDashboard } from '@/lib/cost-structure/dashboard/service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureRead(request); if ('error' in auth) return auth.error;
  const dashboard = await getCostStructureDashboard(Number((await params).id));
  return dashboard ? NextResponse.json(dashboard) : NextResponse.json({ error: 'Active calculation tidak ditemukan.' }, { status: 404 });
}
