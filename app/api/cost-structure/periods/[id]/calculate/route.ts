import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructurePrepare } from '@/lib/cost-structure/auth';
import { CalculationConflictError, runCostStructureCalculation } from '@/lib/cost-structure/calculations/run-service';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructurePrepare(request);
  if ('error' in auth) return auth.error;
  const id = Number((await params).id);
  if (!Number.isSafeInteger(id) || id <= 0) return NextResponse.json({ error: 'Period ID tidak valid.' }, { status: 400 });
  try {
    const calculation = await runCostStructureCalculation(id, auth.user.uid);
    return NextResponse.json({ runId: calculation.runId, runNumber: calculation.runNumber, status: 'SUCCESS' });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Calculation gagal.' }, { status: error instanceof CalculationConflictError ? 409 : 400 });
  }
}
