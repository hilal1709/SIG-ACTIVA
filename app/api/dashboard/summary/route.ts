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
        },
        take: 1000, // Limit for performance
      }),
      
      // Prepaid Summary - Only fetch needed fields
      prisma.prepaid.findMany({
        select: {
          vendor: true,
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

    // Group by location
    const materialByLocation = materialData.reduce((acc: Record<string, { total: number; count: number }>, item) => {
      const location = item.location || 'Unknown';
      if (!acc[location]) {
        acc[location] = { total: 0, count: 0 };
      }
      acc[location].total += item.grandTotal || 0;
      acc[location].count += 1;
      return acc;
    }, {});

    const materialSummary = Object.entries(materialByLocation)
      .map(([location, data]) => ({
        label: location,
        value: data.count,
        amount: data.total,
      }))
      .slice(0, 5); // Top 5 only

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

    // Prepaid by Vendor
    const prepaidByVendor = prepaidData.reduce((acc: Record<string, number>, item) => {
      const vendor = item.vendor || 'Unknown';
      if (!acc[vendor]) {
        acc[vendor] = 0;
      }
      acc[vendor] += item.totalAmount || 0;
      return acc;
    }, {});

    const topVendors = Object.entries(prepaidByVendor)
      .map(([vendor, amount]) => ({
        label: vendor,
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
        topVendors,
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
