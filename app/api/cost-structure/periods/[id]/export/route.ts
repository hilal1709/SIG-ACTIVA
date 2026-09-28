import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureRead } from '@/lib/cost-structure/auth';
import { buildCostStructureExport, recordCostStructureExport } from '@/lib/cost-structure/export/service';

export const runtime = 'nodejs';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureRead(request); if ('error' in auth) return auth.error;
  const periodId = Number((await params).id);
  try {
    const exported = await buildCostStructureExport(periodId);
    await recordCostStructureExport(periodId, exported.runId, exported.status, auth.user.uid);
    return new NextResponse(new Uint8Array(exported.buffer), { headers: { 'content-type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'content-disposition': `attachment; filename="${exported.fileName}"`, 'cache-control': 'private, no-store' } });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : 'Export gagal.' }, { status: 409 }); }
}
