import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Mengambil semua data prepaid
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    let whereClause: any = {};
    if (type && type !== 'All') {
      whereClause.type = type;
    }

    const prepaids = await prisma.prepaid.findMany({
      where: whereClause,
      include: {
        periodes: {
          orderBy: {
            periodeKe: 'asc'
          }
        }
      },
      orderBy: {
        startDate: 'desc'
      }
    });

    // Hitung remaining untuk setiap prepaid
    const prepaidsWithRemaining = prepaids.map((prepaid: any) => {
      const amortizedAmount = prepaid.periodes
        .filter((p: any) => p.isAmortized)
        .reduce((sum: number, p: any) => sum + p.amountPrepaid, 0);
      
      return {
        ...prepaid,
        remaining: prepaid.totalAmount - amortizedAmount
      };
    });

    return NextResponse.json(prepaidsWithRemaining);
  } catch (error) {
    console.error('Error fetching prepaid data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch prepaid data' },
      { status: 500 }
    );
  }
}

// POST - Membuat data prepaid baru
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      companyCode,
      noPo,
      kdAkr,
      alokasi,
      namaAkun,
      vendor,
      deskripsi,
      headerText,
      klasifikasi,
      totalAmount,
      costCenter,
      startDate,
      period,
      periodUnit,
      type,
      pembagianType,
      periodeAmounts // array untuk manual pembagian
    } = body;

    // Validasi input
    if (!kdAkr || !namaAkun || !vendor || !totalAmount || !startDate || !period || !alokasi) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Buat periode-periode
    const startDateObj = new Date(startDate);
    const periodes: any[] = [];

    for (let i = 0; i < period; i++) {
      const periodeDate = new Date(startDateObj);
      periodeDate.setMonth(periodeDate.getMonth() + i);
      
      const bulanNama = periodeDate.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
      const tahun = periodeDate.getFullYear();
      
      let amountPrepaid;
      if (pembagianType === 'manual' && periodeAmounts && periodeAmounts[i]) {
        amountPrepaid = periodeAmounts[i];
      } else {
        // Otomatis - bagi rata
        amountPrepaid = totalAmount / period;
      }

      periodes.push({
        periodeKe: i + 1,
        bulan: bulanNama,
        tahun: tahun,
        amountPrepaid: amountPrepaid,
        isAmortized: false
      });
    }

    // Simpan ke database
    const prepaid = await prisma.prepaid.create({
      data: {
        companyCode,
        noPo,
        kdAkr,
        alokasi,
        namaAkun,
        vendor,
        deskripsi,
        headerText,
        klasifikasi,
        totalAmount,
        remaining: totalAmount,
        costCenter,
        startDate: new Date(startDate),
        period,
        periodUnit: periodUnit || 'bulan',
        type: type || 'Linear',
        pembagianType: pembagianType || 'otomatis',
        periodes: {
          create: periodes
        }
      },
      include: {
        periodes: true
      }
    });

    return NextResponse.json(prepaid, { status: 201 });
  } catch (error) {
    console.error('Error creating prepaid:', error);
    return NextResponse.json(
      { error: 'Failed to create prepaid' },
      { status: 500 }
    );
  }
}

// PUT - Update prepaid
export async function PUT(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Prepaid ID is required' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const {
      companyCode,
      noPo,
      kdAkr,
      alokasi,
      namaAkun,
      vendor,
      deskripsi,
      headerText,
      klasifikasi,
      totalAmount,
      costCenter,
      startDate,
      period,
      periodUnit,
      type,
    } = body;

    // Update prepaid data
    const prepaid = await prisma.prepaid.update({
      where: { id: parseInt(id) },
      data: {
        companyCode,
        noPo,
        kdAkr,
        alokasi,
        namaAkun,
        vendor,
        deskripsi,
        headerText,
        klasifikasi,
        totalAmount,
        costCenter,
        startDate: new Date(startDate),
        period,
        periodUnit,
        type,
      },
      include: {
        periodes: true
      }
    });

    return NextResponse.json(prepaid);
  } catch (error) {
    console.error('Error updating prepaid:', error);
    return NextResponse.json(
      { error: 'Failed to update prepaid' },
      { status: 500 }
    );
  }
}

// DELETE - Menghapus prepaid
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json(
        { error: 'Prepaid ID is required' },
        { status: 400 }
      );
    }

    await prisma.prepaid.delete({
      where: { id: parseInt(id) }
    });

    return NextResponse.json({ message: 'Prepaid deleted successfully' });
  } catch (error) {
    console.error('Error deleting prepaid:', error);
    return NextResponse.json(
      { error: 'Failed to delete prepaid' },
      { status: 500 }
    );
  }
}
