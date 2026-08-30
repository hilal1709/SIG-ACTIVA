import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureAdmin } from '@/lib/cost-structure/auth';
import { hydrateAuditSnapshot } from '@/lib/cost-structure/audit-hydration/service';

export const runtime = 'nodejs';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureAdmin(request);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json(await hydrateAuditSnapshot(Number((await params).id), auth.user.uid));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Audit hydration gagal.' }, { status: 409 });
  }
}
