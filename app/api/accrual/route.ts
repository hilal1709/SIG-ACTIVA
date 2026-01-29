import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// GET - Fetch all accrual data with periodes and realisasi
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search');

    const where: {
      OR?: { 
        kdAkr?: { contains: string; mode: 'insensitive' }; 
        kdAkunBiaya?: { contains: string; mode: 'insensitive' }; 
        vendor?: { contains: string; mode: 'insensitive' }; 
        deskripsi?: { contains: string; mode: 'insensitive' };
        companyCode?: { contains: string; mode: 'insensitive' };
        noPo?: { contains: string; mode: 'insensitive' };
      }[];
    } = {};

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
      select: {
        id: true,
        companyCode: true,
        noPo: true,
        kdAkr: true,
        alokasi: true,
        kdAkunBiaya: true,
        vendor: true,
        deskripsi: true,
        headerText: true,
        klasifikasi: true,
        totalAmount: true,
        costCenter: true,
        startDate: true,
        jumlahPeriode: true,
        pembagianType: true,
        createdAt: true,
        periodes: {
          select: {
            id: true,
            periodeKe: true,
            bulan: true,
            tahun: true,
            amountAccrual: true,
            realisasis: {
              select: {
                id: true,
                tanggalRealisasi: true,
                amount: true,
                keterangan: true
              },
              take: 50
            }
          },
          orderBy: {
            periodeKe: 'asc',
          },
          take: 100
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 1000
    });

    // Calculate total realisasi and saldo for each periode
    const now = new Date();
    const accrualsWithCalculations = accruals.map((accrual: any) => {
      // Calculate amount per periode (total / jumlah periode)
      const amountPerPeriode = accrual.totalAmount / accrual.jumlahPeriode;
      
      return {
        ...accrual,
        periodes: accrual.periodes.map((periode: any, index: number) => {
          // Parse periode date from "Jan 2026" format
          const [monthName, yearStr] = periode.bulan.split(' ');
          const monthMap: { [key: string]: number } = {
            'Jan': 0, 'Feb': 1, 'Mar': 2, 'Apr': 3, 'Mei': 4, 'Jun': 5,
            'Jul': 6, 'Agu': 7, 'Sep': 8, 'Okt': 9, 'Nov': 10, 'Des': 11
          };
          const periodeMonth = monthMap[monthName];
          const periodeYear = parseInt(yearStr);
          
          // Create date for first day of periode month
          const periodeDate = new Date(periodeYear, periodeMonth, 1);
          
          // Total realisasi adalah amount per periode * jumlah periode yang sudah lewat (termasuk periode ini jika sudah lewat)
          let totalRealisasi = 0;
          
          // Hitung berapa banyak periode yang sudah lewat sampai periode saat ini
          if (periodeDate <= now) {
            // Periode ini sudah lewat, maka total realisasi = amount per periode * (index + 1)
            totalRealisasi = amountPerPeriode * (index + 1);
          } else {
            // Periode ini belum lewat, ambil total realisasi dari periode sebelumnya
            totalRealisasi = amountPerPeriode * index;
          }
          
          return {
            ...periode,
            totalRealisasi,
            saldo: periode.amountAccrual - totalRealisasi,
          };
        }),
      };
    });

    return NextResponse.json(accrualsWithCalculations);
  } catch (error) {
    console.error('Error fetching accruals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch accruals' },
      { status: 500 }
    );
  }
}

// POST - Create new accrual entry with periodes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      companyCode, noPo, kdAkr, alokasi, kdAkunBiaya, vendor, deskripsi, headerText, klasifikasi,
      totalAmount, costCenter, startDate, jumlahPeriode, pembagianType, periodeAmounts 
    } = body;

    // Validate required fields
    if (!kdAkr || !kdAkunBiaya || !vendor || !deskripsi || !totalAmount || !startDate || !jumlahPeriode) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Generate periodes data
    const start = new Date(startDate);
    const periodes = [];
    
    for (let i = 0; i < parseInt(jumlahPeriode); i++) {
      const periodeDate = new Date(start);
      periodeDate.setMonth(start.getMonth() + i);
      
      const bulanNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const bulan = `${bulanNames[periodeDate.getMonth()]} ${periodeDate.getFullYear()}`;
      
      let amountAccrual;
      if (pembagianType === 'otomatis') {
        amountAccrual = parseFloat(totalAmount) / parseInt(jumlahPeriode);
      } else {
        amountAccrual = periodeAmounts && periodeAmounts[i] ? parseFloat(periodeAmounts[i]) : 0;
      }
      
      periodes.push({
        periodeKe: i + 1,
        bulan,
        tahun: periodeDate.getFullYear(),
        amountAccrual,
      });
    }

    // Create accrual with periodes
    const accrual = await prisma.accrual.create({
      data: {
        companyCode: companyCode || null,
        noPo: noPo || null,
        kdAkr,
        alokasi: alokasi || null,
        kdAkunBiaya,
        vendor,
        deskripsi,
        headerText: headerText || null,
        klasifikasi: klasifikasi || null,
        totalAmount: parseFloat(totalAmount),
        costCenter: costCenter || null,
        startDate: new Date(startDate),
        jumlahPeriode: parseInt(jumlahPeriode),
        pembagianType: pembagianType || 'otomatis',
        periodes: {
          create: periodes,
        },
      },
      include: {
        periodes: true,
      },
    });

    return NextResponse.json(accrual, { status: 201 });
  } catch (error) {
    console.error('Error creating accrual:', error);
    return NextResponse.json(
      { error: 'Failed to create accrual', details: error instanceof Error ? error.message : 'Unknown error' },
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

// PATCH/PUT - Update accrual entry
export async function PATCH(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const body = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Missing accrual ID' },
        { status: 400 }
      );
    }

    const { 
      companyCode, noPo, kdAkr, alokasi, kdAkunBiaya, vendor, deskripsi, headerText, klasifikasi,
      totalAmount, costCenter, startDate, jumlahPeriode, pembagianType, periodeAmounts 
    } = body;

    // Validate required fields
    if (!kdAkr || !kdAkunBiaya || !vendor || !deskripsi || !totalAmount || !startDate || !jumlahPeriode) {
      return NextResponse.json(
        { error: 'Missing required fields', details: 'kdAkr, kdAkunBiaya, vendor, deskripsi, totalAmount, startDate, dan jumlahPeriode harus diisi' },
        { status: 400 }
      );
    }

    // Generate new periodes data
    const start = new Date(startDate);
    const periodes = [];
    
    for (let i = 0; i < parseInt(jumlahPeriode); i++) {
      const periodeDate = new Date(start);
      periodeDate.setMonth(start.getMonth() + i);
      
      const bulanNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const bulan = `${bulanNames[periodeDate.getMonth()]} ${periodeDate.getFullYear()}`;
      
      let amountAccrual;
      if (pembagianType === 'otomatis') {
        amountAccrual = parseFloat(totalAmount) / parseInt(jumlahPeriode);
      } else {
        amountAccrual = periodeAmounts && periodeAmounts[i] ? parseFloat(periodeAmounts[i]) : 0;
      }
      
      periodes.push({
        periodeKe: i + 1,
        bulan,
        tahun: periodeDate.getFullYear(),
        amountAccrual,
      });
    }

    // Delete existing periodes and create new ones
    await prisma.accrualPeriode.deleteMany({
      where: {
        accrualId: parseInt(id),
      },
    });

    // Update accrual with new periodes
    const accrual = await prisma.accrual.update({
      where: {
        id: parseInt(id),
      },
      data: {
        companyCode: companyCode || null,
        noPo: noPo || null,
        kdAkr,
        alokasi: alokasi || null,
        kdAkunBiaya,
        vendor,
        deskripsi,
        headerText: headerText || null,
        klasifikasi: klasifikasi || null,
        totalAmount: parseFloat(totalAmount),
        costCenter: costCenter || null,
        startDate: new Date(startDate),
        jumlahPeriode: parseInt(jumlahPeriode),
        pembagianType,
        periodes: {
          create: periodes,
        },
      },
      include: {
        periodes: true,
      },
    });

    return NextResponse.json(accrual);
  } catch (error) {
    console.error('Error updating accrual:', error);
    return NextResponse.json(
      { error: 'Failed to update accrual', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export const PUT = PATCH; // Alias PUT to PATCH

