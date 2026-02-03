
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Parallel fetching for better performance
    const [materialData, prepaidData, accrualData] = await Promise.all([
      // Material Data Summary - Only fetch needed fields
      prisma.materialData.findMany({
        select: {
          location: true,
          grandTotal: true,
          materialId: true,
          stokAwalSelisih: true,
          produksiSelisih: true,
          rilisSelisih: true,
          stokAkhirSelisih: true,
        },
        take: 1000, // Limit for performance
      }),
      
      // Prepaid Summary - Only fetch needed fields
      prisma.prepaid.findMany({
        select: {
          vendor: true,
          namaAkun: true,
          alokasi: true,
          klasifikasi: true,
          totalAmount: true,
          remaining: true,
          periodes: {
            select: {
              isAmortized: true,
            },
          },
        },
      }),
      
      // Accrual Summary - Only fetch needed fields
      prisma.accrual.findMany({
        select: {
          vendor: true,
          klasifikasi: true,
          totalAmount: true,
          periodes: {
            select: {
              realisasis: {
                select: {
                  amount: true,
                },
              },
            },
          },
        },
      }),
    ]);

    // Group by location with selisih calculation
    const materialByLocation = materialData.reduce((acc: Record<string, { totalSelisih: number; countSelisih: number; countClear: number }>, item) => {
      const location = item.location || 'Unknown';
      if (!acc[location]) {
        acc[location] = { totalSelisih: 0, countSelisih: 0, countClear: 0 };
      }
      
      // Calculate total selisih from all selisih fields
      const totalItemSelisih = Math.abs(item.stokAwalSelisih || 0) + 
                                Math.abs(item.produksiSelisih || 0) + 
                                Math.abs(item.rilisSelisih || 0) + 
                                Math.abs(item.stokAkhirSelisih || 0);
      
      acc[location].totalSelisih += totalItemSelisih;
      
      if (totalItemSelisih > 0) {
        acc[location].countSelisih += 1;
      } else {
        acc[location].countClear += 1;
      }
      
      return acc;
    }, {});

    const materialSummary = Object.entries(materialByLocation)
      .map(([location, data]) => ({
        label: location,
        value: data.totalSelisih,
        countSelisih: data.countSelisih,
        countClear: data.countClear,
        amount: data.totalSelisih,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5); // Top 5 by selisih

    // Material by ID prefix (first 2 chars as type)
    const materialByType = materialData.reduce((acc: Record<string, number>, item) => {
      const type = item.materialId.substring(0, 2) || 'XX';
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type] += 1;
      return acc;
    }, {});

    const materialTypeData = Object.entries(materialByType)
      .map(([type, count]) => ({
        label: `Tipe ${type}`,
        value: count,
      }))
      .slice(0, 5); // Top 5 only

    // Calculate prepaid status (based on remaining amount)
    const prepaidStatus = {
      active: prepaidData.filter((p) => p.remaining > 0).length,
      cleared: prepaidData.filter((p) => p.remaining === 0).length,
      pending: prepaidData.filter((p) => p.periodes.some(period => !period.isAmortized)).length,
    };

    const totalPrepaid = prepaidData.reduce((sum: number, item) => sum + (item.totalAmount || 0), 0);
    const totalRemaining = prepaidData.reduce((sum: number, item) => sum + (item.remaining || 0), 0);
    const totalCleared = totalPrepaid - totalRemaining;

    // Top Prepaid by Amount (instead of by vendor)
    const topPrepaidByAmount = prepaidData
      .map((item) => ({
        label: `${item.namaAkun} - ${item.alokasi}`,
        value: item.totalAmount,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Prepaid by Klasifikasi
    const prepaidByKlasifikasi = prepaidData.reduce((acc: Record<string, number>, item) => {
      const klasifikasi = item.klasifikasi || 'Tidak ada klasifikasi';
      if (!acc[klasifikasi]) {
        acc[klasifikasi] = 0;
      }
      acc[klasifikasi] += item.totalAmount || 0;
      return acc;
    }, {});

    const topPrepaidByKlasifikasi = Object.entries(prepaidByKlasifikasi)
      .map(([klasifikasi, amount]) => ({
        label: klasifikasi,
        value: amount as number,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Calculate accrual totals and status
    const accrualWithCalculations = accrualData.map((accrual) => {
      const totalRealized = accrual.periodes.reduce((sum: number, periode) => {
        return sum + periode.realisasis.reduce((rSum: number, realisasi) => rSum + realisasi.amount, 0);
      }, 0);
      const remaining = accrual.totalAmount - totalRealized;
      return {
        ...accrual,
        totalRealized,
        remaining,
      };
    });

    const accrualStatus = {
      active: accrualWithCalculations.filter((a) => a.remaining > 0).length,
      cleared: accrualWithCalculations.filter((a) => a.remaining === 0).length,
      pending: accrualWithCalculations.filter((a) => a.remaining > a.totalAmount * 0.5).length,
    };

    const totalAccrual = accrualData.reduce((sum: number, item) => sum + (item.totalAmount || 0), 0);
    const totalRealized = accrualWithCalculations.reduce((sum: number, item) => sum + item.totalRealized, 0);
    const totalAccrualRemaining = totalAccrual - totalRealized;

    // Accrual by Vendor
    const accrualByVendor = accrualData.reduce((acc: Record<string, number>, item) => {
      const vendor = item.vendor || 'Unknown';
      if (!acc[vendor]) {
        acc[vendor] = 0;
      }
      acc[vendor] += item.totalAmount || 0;
      return acc;
    }, {});

    const topAccrualVendors = Object.entries(accrualByVendor)
      .map(([vendor, amount]) => ({
        label: vendor,
        value: amount as number,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    // Accrual by Klasifikasi
    const accrualByKlasifikasi = accrualData.reduce((acc: Record<string, number>, item) => {
      const klasifikasi = item.klasifikasi || 'Tidak ada klasifikasi';
      if (!acc[klasifikasi]) {
        acc[klasifikasi] = 0;
      }
      acc[klasifikasi] += item.totalAmount || 0;
      return acc;
    }, {});

    const topAccrualByKlasifikasi = Object.entries(accrualByKlasifikasi)
      .map(([klasifikasi, amount]) => ({
        label: klasifikasi,
        value: amount as number,
      }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    return NextResponse.json({
      material: {
        summary: materialSummary,
        byType: materialTypeData,
        total: materialData.length,
      },
      prepaid: {
        status: prepaidStatus,
        financial: {
          total: totalPrepaid,
          cleared: totalCleared,
          remaining: totalRemaining,
        },
        topPrepaidByAmount,
        topByKlasifikasi: topPrepaidByKlasifikasi,
        total: prepaidData.length,
      },
      accrual: {
        status: accrualStatus,
        financial: {
          total: totalAccrual,
          realized: totalRealized,
          remaining: totalAccrualRemaining,
        },
        topVendors: topAccrualVendors,
        topByKlasifikasi: topAccrualByKlasifikasi,
        total: accrualData.length,
      },
    });
  } catch (error) {
    console.error('Dashboard summary error:', error);
    return NextResponse.json(
      { error: 'Gagal mengambil ringkasan data' },
      { status: 500 }
    );
  }
}
