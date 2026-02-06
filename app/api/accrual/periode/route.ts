import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// PUT - Update periode amount
export async function PUT(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Missing periode ID' },
        { status: 400 }
      );
    }

    const { amountAccrual } = body;

    if (amountAccrual === undefined || amountAccrual === null) {
      return NextResponse.json(
        { error: 'Missing amount accrual' },
        { status: 400 }
      );
    }

    // Update periode amount
    const periode = await prisma.accrualPeriode.update({
      where: {
        id: parseInt(id),
      },
      data: {
        amountAccrual: parseFloat(amountAccrual),
      },
      include: {
        accrual: {
          include: {
            periodes: true,
          },
        },
      },
    });

    // Recalculate total amount from all periodes
    const allPeriodes = await prisma.accrualPeriode.findMany({
      where: {
        accrualId: periode.accrualId,
      },
    });

    const newTotalAmount = allPeriodes.reduce((sum, p) => sum + p.amountAccrual, 0);

    // Update parent accrual totalAmount
    await prisma.accrual.update({
      where: {
        id: periode.accrualId,
      },
      data: {
        totalAmount: newTotalAmount,
      },
    });

    return NextResponse.json(periode);
  } catch (error) {
    console.error('Error updating periode:', error);
    return NextResponse.json(
      { error: 'Failed to update periode' },
      { status: 500 }
    );
  }
}
