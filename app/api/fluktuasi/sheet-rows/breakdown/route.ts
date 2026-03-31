import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { NextRequest } from 'next/server';
import { requireFinanceRead } from '@/lib/api-auth';

const parseNum = (val: unknown): number => {
  if (typeof val === 'number') return val;
  if (val === null || val === undefined || val === '') return 0;
  let s = String(val).trim();
  if (!s) return 0;
  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  s = s.replace(/[^\d.,]/g, '');
  if (!s) return 0;
  const n = Number(s.replace(/[.,]/g, ''));
  if (isNaN(n)) return 0;
  return negative ? -n : n;
};

// GET /api/fluktuasi/sheet-rows/breakdown
// Returns per-account per-klasifikasi per-periode amounts aggregated from FluktuasiSheetRows.
// Used by the rekap table to show breakdown in template reason without needing local sheetDataList.
export async function GET(request: NextRequest) {
  try {
    const auth = await requireFinanceRead(request);
    if ('error' in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const accountCode = searchParams.get('accountCode'); // optional filter

    const sheets = await prisma.fluktuasiSheetRows.findMany({
      where: accountCode ? { accountCode } : undefined,
      select: { accountCode: true, rows: true },
    });

    // Map: accountCode -> klasifikasi -> periode -> amount
    const result: Record<string, Record<string, Record<string, number>>> = {};

    for (const sheet of sheets) {
      const code = String(sheet.accountCode ?? '').trim().match(/^(\d{5,})/)?.[1]
        ?? String(sheet.accountCode ?? '').trim();
      if (!code) continue;

      const rows = sheet.rows as Record<string, unknown>[];
      if (!Array.isArray(rows)) continue;

      if (!result[code]) result[code] = {};

      for (const row of rows) {
        const klas   = String(row['__klasifikasi'] ?? '').trim() || '(Lainnya)';
        const per    = String(row['__periode']     ?? '').trim();
        const amount = parseNum(row['__amount']    ?? 0);
        if (!per || amount === 0) continue;

        if (!result[code][klas]) result[code][klas] = {};
        result[code][klas][per] = (result[code][klas][per] ?? 0) + amount;
      }
    }

    const res = NextResponse.json({ success: true, data: result });
    res.headers.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    return res;
  } catch (error) {
    console.error('Error fetching sheet rows breakdown:', error);
    return NextResponse.json(
      { success: false, error: 'Gagal mengambil breakdown klasifikasi' },
      { status: 500 },
    );
  }
}
