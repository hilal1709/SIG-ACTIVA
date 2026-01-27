import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Tandai periode sebagai telah diamortisasi
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { periodeId, isAmortized, amortizedDate } = body;

    if (!periodeId) {
      return NextResponse.json(
        { error: 'Periode ID is required' },
        { status: 400 }
      );
    }

    const periode = await prisma.prepaidPeriode.update({
      where: { id: periodeId },
      data: {
        isAmortized: isAmortized !== undefined ? isAmortized : true,
        amortizedDate: amortizedDate ? new Date(amortizedDate) : new Date()
      }
    });

    // Update remaining di prepaid utama
    const prepaidPeriodes = await prisma.prepaidPeriode.findMany({
      where: { prepaidId: periode.prepaidId }
    });

    const amortizedAmount = prepaidPeriodes
      .filter((p: any) => p.isAmortized)
      .reduce((sum: number, p: any) => sum + p.amountPrepaid, 0);

    const prepaid = await prisma.prepaid.findUnique({
      where: { id: periode.prepaidId }
    });

    if (prepaid) {
      await prisma.prepaid.update({
        where: { id: periode.prepaidId },
        data: {
          remaining: prepaid.totalAmount - amortizedAmount
        }
      });
    }

    return NextResponse.json(periode);
  } catch (error) {
    console.error('Error updating periode:', error);
    return NextResponse.json(
      { error: 'Failed to update periode' },
      { status: 500 }
    );
  }
}
