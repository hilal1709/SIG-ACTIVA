import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all accrual data with optional filtering
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const where: {
      status?: string;
      OR?: { 
        kdAkr?: { contains: string; mode: 'insensitive' }; 
        kdAkunBiaya?: { contains: string; mode: 'insensitive' }; 
        vendor?: { contains: string; mode: 'insensitive' }; 
        deskripsi?: { contains: string; mode: 'insensitive' };
        companyCode?: { contains: string; mode: 'insensitive' };
        noPo?: { contains: string; mode: 'insensitive' };
      }[];
    } = {};

    // Filter by status
    if (status && status !== 'All') {
      where.status = status;
    }

    // Filter by search term
    if (search) {
      where.OR = [
        { kdAkr: { contains: search, mode: 'insensitive' } },
        { kdAkunBiaya: { contains: search, mode: 'insensitive' } },
        { vendor: { contains: search, mode: 'insensitive' } },
        { deskripsi: { contains: search, mode: 'insensitive' } },
        { companyCode: { contains: search, mode: 'insensitive' } },
        { noPo: { contains: search, mode: 'insensitive' } },
      ];
    }

    const accruals = await prisma.accrual.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json(accruals);
  } catch (error) {
    console.error('Error fetching accruals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accruals' },
      { status: 500 }
    );
  }
}

// POST - Create new accrual entry
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { companyCode, noPo, kdAkr, alokasi, kdAkunBiaya, vendor, deskripsi, amount, costCenter, accrDate, periode, status, type } = body;

    // Validate required fields
    if (!kdAkr || !kdAkunBiaya || !vendor || !deskripsi || !amount || !accrDate) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const accrual = await prisma.accrual.create({
      data: {
        companyCode: companyCode || null,
        noPo: noPo || null,
        kdAkr,
        alokasi: alokasi || null,
        kdAkunBiaya,
        vendor,
        deskripsi,
        amount: parseFloat(amount),
        costCenter: costCenter || null,
        accrDate: new Date(accrDate),
        periode: periode || null,
        status: status || 'Pending',
        type: type || 'Linear',
      },
    });

    return NextResponse.json(accrual, { status: 201 });
  } catch (error) {
    console.error('Error creating accrual:', error);
    return NextResponse.json(
      { error: 'Failed to create accrual' },
      { status: 500 }
    );
  }
}

// DELETE - Delete accrual entry
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Missing accrual ID' },
        { status: 400 }
      );
    }

    await prisma.accrual.delete({
      where: {
        id: parseInt(id),
      },
    });

    return NextResponse.json({ message: 'Accrual deleted successfully' });
  } catch (error) {
    console.error('Error deleting accrual:', error);
    return NextResponse.json(
      { error: 'Failed to delete accrual' },
      { status: 500 }
    );
  }
}

// PATCH - Update accrual entry
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { id, ...updateData } = body;

    if (!id) {
      return NextResponse.json(
        { error: 'Missing accrual ID' },
        { status: 400 }
      );
    }

    // Convert date and amount if provided
    if (updateData.accrDate) {
      updateData.accrDate = new Date(updateData.accrDate);
    }
    if (updateData.amount) {
      updateData.amount = parseFloat(updateData.amount);
    }

    const accrual = await prisma.accrual.update({
      where: {
        id: parseInt(id),
      },
      data: updateData,
    });

    return NextResponse.json(accrual);
  } catch (error) {
    console.error('Error updating accrual:', error);
    return NextResponse.json(
      { error: 'Failed to update accrual' },
      { status: 500 }
    );
  }
}
