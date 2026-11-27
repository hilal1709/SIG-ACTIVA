import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionCookieName, verifySessionToken } from '@/lib/session';
import { canReadHpp } from '@/lib/hpp/access';
import { HPP_MAX_OBSERVATIONS, HPP_MAX_COMBINATIONS, parseHppYear, pivotHppHistory } from '@/lib/hpp/history';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function reply(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } });
}
export async function GET(request: NextRequest) {
  const session = await verifySessionToken(request.cookies.get(getSessionCookieName())?.value);
  if (!session) return reply({ error: 'Unauthorized' }, 401);
  if (!canReadHpp(session.role)) return reply({ error: 'Forbidden' }, 403);
  let requested: number | null;
  try { requested = parseHppYear(request.nextUrl.searchParams.get('year')); }
  catch { return reply({ error: 'Tahun harus antara 2000 dan 2100' }, 400); }
  try {
    // The year list, active versions, and their observations must be read consistently.
    const result = await prisma.$transaction(async tx => {
      const available = await tx.hppPeriodVersion.findMany({
        where: { isCurrent: true, publishedAt: { not: null } },
        select: { fiscalYear: true }, distinct: ['fiscalYear'], orderBy: { fiscalYear: 'desc' },
      });
      const years = available.map(x => x.fiscalYear);
      const year = requested ?? years[0] ?? null;
      if (year === null) return { years, year, periods: [], rows: [], observationCount: 0 };
      const versions = await tx.hppPeriodVersion.findMany({
        where: { fiscalYear: year, isCurrent: true, publishedAt: { not: null } },
        select: { id: true, fiscalPeriod: true, revision: true, publishedAt: true },
        orderBy: { fiscalPeriod: 'asc' },
      });
      const periods = versions.map(v => ({ period: v.fiscalPeriod, revision: v.revision, publishedAt: v.publishedAt?.toISOString() ?? null }));
      if (!versions.length) return { years, year, periods, rows: [], observationCount: 0 };
      const versionIds = versions.map(v => v.id);
      const observations = await tx.hppObservation.findMany({
        where: { periodVersionId: { in: versionIds } },
        select: { periodVersionId: true, materialCode: true, materialName: true, plant: true, cogm: true, deliveryQty: true },
        take: HPP_MAX_OBSERVATIONS + 1,
      });
      if (observations.length > HPP_MAX_OBSERVATIONS) return null;
      const combinations = new Set(observations.map(o => JSON.stringify([o.materialCode, o.plant])));
      if (combinations.size > HPP_MAX_COMBINATIONS) return null;
      const month = new Map(versions.map(v => [v.id, v.fiscalPeriod]));
      const rows = pivotHppHistory(observations.map(o => ({
        period: month.get(o.periodVersionId)!,
        materialCode: o.materialCode, materialName: o.materialName, plant: o.plant,
        cogm: o.cogm?.toString() ?? null, deliveryQty: o.deliveryQty?.toString() ?? null,
      })));
      return { years, year, periods, rows, observationCount: observations.length };
    }, { isolationLevel: 'RepeatableRead', timeout: 15000 });
    if (result === null) return reply({ error: 'Cakupan data melebihi batas dashboard; hubungi administrator.' }, 413);
    return reply(result);
  } catch (error) {
    console.error('[HPP history] Read failed', error instanceof Error ? error.name : 'UnknownError');
    return reply({ error: 'Database HPP belum tersedia atau tidak dapat dibaca. Coba kembali atau gunakan snapshot lokal.' }, 503);
  }
}
