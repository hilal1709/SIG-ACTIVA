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

    // Update periode amount (accrual disimpan positif)
    const periode = await prisma.accrualPeriode.update({
      where: {
        id: parseInt(id),
      },
      data: {
        amountAccrual: Math.abs(parseFloat(amountAccrual)),
      },
      include: {
        accrual: true, // Tidak perlu include periodes
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
