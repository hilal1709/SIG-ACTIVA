import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    // Material Data Summary
    const materialData = await prisma.materialData.findMany({
      select: {
        location: true,
        grandTotal: true,
        materialId: true,
      },
    });

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

    const materialSummary = Object.entries(materialByLocation).map(([location, data]) => ({
      label: location,
      value: data.count,
      amount: data.total,
    }));

    // Material by ID prefix (first 2 chars as type)
    const materialByType = materialData.reduce((acc: Record<string, number>, item) => {
      const type = item.materialId.substring(0, 2) || 'XX';
      if (!acc[type]) {
        acc[type] = 0;
      }
      acc[type] += 1;
      return acc;
    }, {});

    const materialTypeData = Object.entries(materialByType).map(([type, count]) => ({
      label: `Tipe ${type}`,
      value: count,
    }));

    // Prepaid Summary
    const prepaidData = await prisma.prepaid.findMany({
      include: {
        periodes: true,
      },
    });

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

    // Accrual Summary
    const accrualData = await prisma.accrual.findMany({
      include: {
        periodes: {
          include: {
            realisasis: true,
          },
        },
      },
    });

    // Calculate accrual totals and status
    const accrualWithCalculations = accrualData.map((accrual) => {
      const totalRealized = accrual.periodes.reduce((sum, periode) => {
        return sum + periode.realisasis.reduce((rSum, realisasi) => rSum + realisasi.amount, 0);
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

    // Recent Activity
    const recentMaterialImports = await prisma.materialData.findMany({
      orderBy: { importDate: 'desc' },
      take: 5,
      select: {
        importDate: true,
        location: true,
      },
    });

    return NextResponse.json({
      material: {
        summary: materialSummary,
        byType: materialTypeData,
        total: materialData.length,
        recentImports: recentMaterialImports,
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
