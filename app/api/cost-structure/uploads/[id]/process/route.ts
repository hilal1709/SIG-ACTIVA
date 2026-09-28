import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare, requireCostStructureRead } from '@/lib/cost-structure/auth';
import { advanceCostStructureProcess, CostStructureProcessNotFoundError, getCostStructureProcessStatus } from '@/lib/cost-structure/processing/service';

export const runtime = 'nodejs';
export const maxDuration = 60;

function parseId(value: string) {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureRead(request);
  if ('error' in auth) return auth.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Upload ID tidak valid.' }, { status: 400 });
  try {
    return NextResponse.json(await getCostStructureProcessStatus(id));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Status proses gagal dimuat.' }, { status: error instanceof CostStructureProcessNotFoundError ? 404 : 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructurePrepare(request);
  if ('error' in auth) return auth.error;
  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: 'Upload ID tidak valid.' }, { status: 400 });
  try {
    return NextResponse.json(await advanceCostStructureProcess(id, auth.user.uid));
  } catch (error) {
    // Return the persisted stage whenever possible so clients retain exact blockers and can retry.
    const status = await getCostStructureProcessStatus(id).catch(() => null);
    if (status) return NextResponse.json({ ...status, error: error instanceof Error ? error.message : 'Tahap proses gagal.' }, { status: 409 });
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Tahap proses gagal.' }, { status: error instanceof CostStructureProcessNotFoundError ? 404 : 500 });
  }
}
