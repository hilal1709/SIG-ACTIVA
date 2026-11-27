import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureAdmin } from '@/lib/cost-structure/auth';
import { reopenCostStructure } from '@/lib/cost-structure/finalization/service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureAdmin(request); if ('error' in auth) return auth.error;
  const body = await request.json().catch(() => ({})) as { reason?: string };
  try { return NextResponse.json(await reopenCostStructure(Number((await params).id), auth.user.uid, body.reason ?? '')); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Reopen gagal.' }, { status: 409 }); }
}
