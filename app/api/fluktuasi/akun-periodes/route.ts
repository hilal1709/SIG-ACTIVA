import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { broadcast } from '@/lib/sse';
import { sendPushToAll } from '@/lib/webpush';
import { checkFluktuasiAlerts } from '@/lib/notificationChecker';

const dbErrorMessage = (error: unknown, fallback: string): string => {
  const message = error instanceof Error ? error.message : String(error ?? 'Unknown error');
  if (/planLimitReached/i.test(message)) {
    return 'Koneksi database ditolak: limit paket Prisma sudah tercapai (planLimitReached).';
  }
  if (/P1001|Can\'t reach database server/i.test(message)) {
    return 'Koneksi database gagal (P1001): server database tidak terjangkau.';
  }
  return fallback;
};

// ─── GET: Ambil semua account-period records ─────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountCode = searchParams.get('accountCode');
    const periode     = searchParams.get('periode');
    // "slim" mode: overview page only needs these 5 fields — skip heavy cols
    const slim = searchParams.get('slim') === '1';

    const records = await prisma.fluktuasiAkunPeriode.findMany({
      where: {
        ...(accountCode ? { accountCode } : {}),
        ...(periode     ? { periode }     : {}),
      },
      // skip uploadedBy / fileName / createdAt / updatedAt / remark for slim
      select: slim
        ? { accountCode: true, periode: true, amount: true, klasifikasi: true }
        : undefined,
      // client sorts anyway — skip DB sort in slim mode to reduce query cost
      orderBy: slim ? undefined : [{ accountCode: 'asc' }, { periode: 'asc' }],
    });

    const res = NextResponse.json({ success: true, data: records });
    // Allow CDN/browser to serve stale while revalidating (30 s fresh, 60 s stale)
    res.headers.set('Cache-Control', 'public, s-maxage=30, stale-while-revalidate=60');
    return res;
  } catch (error) {
    console.error('Error fetching akun periodes:', error);
    return NextResponse.json(
      { success: false, error: dbErrorMessage(error, 'Gagal mengambil data akun periode') },
      { status: 500 },
    );
  }
}

// ─── POST: Batch upsert account-period records ───────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { records, uploadedBy = 'system', fileName = '' } = body as {
      records: {
        accountCode: string;
        periode: string;
        amount: number;
        klasifikasi: string;
        remark: string;
      }[];
      uploadedBy?: string;
      fileName?: string;
    };

    if (!Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: 'records harus berupa array tidak kosong' },
        { status: 400 },
      );
    }

    // Preserve previously stored non-zero amounts when a newer upload sends 0
    // for the same account+periode key.
    const uniqKeys = [...new Set(records.map((r) => `${r.accountCode}__${r.periode}`))]
      .map((k) => {
        const [accountCode, periode] = k.split('__');
        return { accountCode, periode };
      });

    const existingRows = await prisma.fluktuasiAkunPeriode.findMany({
      where: {
        OR: uniqKeys.map((k) => ({ accountCode: k.accountCode, periode: k.periode })),
      },
      select: {
        accountCode: true,
        periode: true,
        amount: true,
        klasifikasi: true,
        remark: true,
      },
    });

    const existingMap = new Map<string, { amount: number; klasifikasi: string; remark: string }>();
    for (const row of existingRows) {
      existingMap.set(`${row.accountCode}__${row.periode}`, {
        amount: row.amount,
        klasifikasi: row.klasifikasi ?? '',
        remark: row.remark ?? '',
      });
    }

    // Batch upsert in small chunks to avoid connection spikes when uploading
    // large files (previously this caused partial save failures on production DB).
    const UPSERT_BATCH_SIZE = 100;
    let success = 0;
    let failed = 0;
    const failedSamples: string[] = [];

    const upsertOne = (r: {
      accountCode: string;
      periode: string;
      amount: number;
      klasifikasi: string;
      remark: string;
    }) => {
      const existing = existingMap.get(`${r.accountCode}__${r.periode}`);
      const keepExistingAmount = !!existing && Number(r.amount) === 0 && Number(existing.amount) !== 0;
      const effectiveAmount = keepExistingAmount ? existing.amount : r.amount;
      const effectiveKlasifikasi = String(r.klasifikasi ?? '').trim() || existing?.klasifikasi || '';
      const effectiveRemark = String(r.remark ?? '').trim() || existing?.remark || '';

      return prisma.fluktuasiAkunPeriode.upsert({
        where: { accountCode_periode: { accountCode: r.accountCode, periode: r.periode } },
        update: {
          amount:      effectiveAmount,
          klasifikasi: effectiveKlasifikasi,
          remark:      effectiveRemark,
          uploadedBy,
          fileName,
        },
        create: {
          accountCode: r.accountCode,
          periode:     r.periode,
          amount:      effectiveAmount,
          klasifikasi: effectiveKlasifikasi,
          remark:      effectiveRemark,
          uploadedBy,
          fileName,
        },
      });
    };

    for (let i = 0; i < records.length; i += UPSERT_BATCH_SIZE) {
      const chunk = records.slice(i, i + UPSERT_BATCH_SIZE);
      const chunkResults = await Promise.allSettled(chunk.map((r) => upsertOne(r)));

      const retryRows: typeof chunk = [];
      chunkResults.forEach((result, idx) => {
        if (result.status === 'fulfilled') {
          success++;
          return;
        }
        retryRows.push(chunk[idx]);
      });

      if (!retryRows.length) continue;

      const retryResults = await Promise.allSettled(retryRows.map((r) => upsertOne(r)));
      for (const result of retryResults) {
        if (result.status === 'fulfilled') {
          success++;
          continue;
        }
        failed++;
        if (failedSamples.length < 5) {
          const message =
            result.reason instanceof Error
              ? result.reason.message
              : String(result.reason ?? 'Unknown upsert error');
          failedSamples.push(message);
        }
      }
    }

    broadcast('fluktuasi');
    sendPushToAll({ title: 'Data Fluktuasi Diperbarui', body: `${success} record fluktuasi berhasil disimpan`, url: '/fluktuasi-oi', priority: 'medium' }).catch(() => {});
    checkFluktuasiAlerts().catch(() => {});
    return NextResponse.json({
      success: true,
      message: `${success} record berhasil disimpan${failed ? `, ${failed} gagal` : ''}`,
      saved: success,
      failed,
      failedSamples,
    });
  } catch (error) {
    console.error('Error upserting akun periodes:', error);
    return NextResponse.json(
      { success: false, error: dbErrorMessage(error, 'Gagal menyimpan data akun periode') },
      { status: 500 },
    );
  }
}

// ─── DELETE: Hapus semua record (atau per accountCode) ───────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const accountCode = searchParams.get('accountCode');
    const periode     = searchParams.get('periode');

    const deleted = await prisma.fluktuasiAkunPeriode.deleteMany({
      where: {
        ...(accountCode ? { accountCode } : {}),
        ...(periode     ? { periode }     : {}),
      },
    });

    broadcast('fluktuasi');
    sendPushToAll({ title: 'Data Fluktuasi Dihapus', body: `${deleted.count} record fluktuasi berhasil dihapus`, url: '/fluktuasi-oi', priority: 'low' }).catch(() => {});
    return NextResponse.json({
      success: true,
      message: `${deleted.count} record berhasil dihapus`,
      count: deleted.count,
    });
  } catch (error) {
    console.error('Error deleting akun periodes:', error);
    return NextResponse.json(
      { success: false, error: dbErrorMessage(error, 'Gagal menghapus data akun periode') },
      { status: 500 },
    );
  }
}
