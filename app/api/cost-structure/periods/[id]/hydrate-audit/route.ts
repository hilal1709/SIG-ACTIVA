import { NextRequest, NextResponse } from 'next/server';
import { requireCostStructureAdmin } from '@/lib/cost-structure/auth';
import { hydrateAuditSnapshot } from '@/lib/cost-structure/audit-hydration/service';

export const runtime = 'nodejs';

function parseOptionalUploadId(value: unknown) {
  if (value === undefined || value === null) return undefined;
  const uploadId = Number(value);
  return Number.isSafeInteger(uploadId) && uploadId > 0 ? uploadId : null;
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireCostStructureAdmin(request);
  if ('error' in auth) return auth.error;

  const body = await request.json().catch(() => ({} as Record<string, unknown>));
  const expectedUploadId = parseOptionalUploadId((body as Record<string, unknown>).expectedUploadId);
  if (expectedUploadId === null) return NextResponse.json({ error: 'Upload ID tidak valid.' }, { status: 400 });

  try {
    return NextResponse.json(await hydrateAuditSnapshot(Number((await params).id), auth.user.uid, expectedUploadId));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Audit hydration gagal.' }, { status: 409 });
  }
}
