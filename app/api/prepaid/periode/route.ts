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

    // @ts-expect-error - Prisma model sudah di-generate, TypeScript cache belum update
    const periode = await prisma.prepaidPeriode.update({
      where: { id: periodeId },
      data: {
        isAmortized: isAmortized !== undefined ? isAmortized : true,
        amortizedDate: amortizedDate ? new Date(amortizedDate) : new Date()
      }
    });

    // Update remaining di prepaid utama
    // @ts-expect-error - Prisma model sudah di-generate, TypeScript cache belum update
    const prepaidPeriodes = await prisma.prepaidPeriode.findMany({
      where: { prepaidId: periode.prepaidId }
    });

    const amortizedAmount = prepaidPeriodes
      .filter((p: any) => p.isAmortized)
      .reduce((sum: number, p: any) => sum + p.amountPrepaid, 0);

    // @ts-expect-error - Prisma model sudah di-generate, TypeScript cache belum update
    const prepaid = await prisma.prepaid.findUnique({
      where: { id: periode.prepaidId }
    });

    if (prepaid) {
      // @ts-expect-error - Prisma model sudah di-generate, TypeScript cache belum update
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
