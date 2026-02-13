import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseExcelFile, ExcelAccrualData } from '@/app/utils/excelParser';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type
    if (!file.name.match(/\.(xlsx|xls)$/)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload an Excel file (.xlsx or .xls)' },
        { status: 400 }
      );
    }

    // Parse the Excel file
    const buffer = await file.arrayBuffer();
    const { accruals, errors } = parseExcelFile(buffer);

    if (errors.length > 0) {
      console.warn('Excel parsing warnings:', errors);
    }

    if (accruals.length === 0) {
      return NextResponse.json(
        { 
          error: 'No accrual data found in the Excel file',
          warnings: errors 
        },
        { status: 400 }
      );
    }

    // Satu baris Excel = satu record accrual (vendor sama, no PO beda = baris terpisah)
    const results = [];
    const processedErrors = [];

    for (const excelAccrual of accruals) {
      try {
        const hasNoPoAndVendor =
          excelAccrual.noPo && excelAccrual.vendor;

        // Match existing: by kdAkr+noPo+vendor (sheet) atau kdAkr+klasifikasi (rekap)
        const existingAccrual = await prisma.accrual.findFirst({
          where: hasNoPoAndVendor
            ? {
                kdAkr: excelAccrual.kdAkr,
                noPo: excelAccrual.noPo,
                vendor: excelAccrual.vendor,
              }
            : {
                kdAkr: excelAccrual.kdAkr,
                klasifikasi: excelAccrual.klasifikasi ?? null,
              },
        });

        if (existingAccrual) {
          const updatedAccrual = await prisma.accrual.update({
            where: { id: existingAccrual.id },
            data: {
              totalAmount: excelAccrual.totalAmount ?? excelAccrual.saldo,
              ...(excelAccrual.vendor != null && { vendor: excelAccrual.vendor }),
              ...(excelAccrual.deskripsi != null && { deskripsi: excelAccrual.deskripsi }),
              ...(excelAccrual.kdAkunBiaya != null && { kdAkunBiaya: excelAccrual.kdAkunBiaya }),
              ...(excelAccrual.klasifikasi != null && { klasifikasi: excelAccrual.klasifikasi }),
              ...(excelAccrual.noPo != null && { noPo: excelAccrual.noPo }),
              ...(excelAccrual.alokasi != null && { alokasi: excelAccrual.alokasi }),
            },
            include: { periodes: true },
          });

          if (updatedAccrual.periodes.length > 0) {
            const total = excelAccrual.totalAmount ?? excelAccrual.saldo;
            const amountPerPeriode = total / updatedAccrual.periodes.length;
            await prisma.accrualPeriode.updateMany({
              where: { accrualId: existingAccrual.id },
              data: { amountAccrual: amountPerPeriode },
            });
          }

          results.push({
            kdAkr: excelAccrual.kdAkr,
            noPo: excelAccrual.noPo,
            vendor: excelAccrual.vendor,
            klasifikasi: excelAccrual.klasifikasi,
            action: 'updated',
            saldo: excelAccrual.saldo,
            id: existingAccrual.id,
          });
        } else {
          const newAccrual = await prisma.accrual.create({
            data: {
              kdAkr: excelAccrual.kdAkr,
              kdAkunBiaya: excelAccrual.kdAkunBiaya ?? 'DEFAULT',
              vendor: excelAccrual.vendor ?? 'IMPORTED FROM EXCEL',
              deskripsi:
                excelAccrual.deskripsi ??
                `Imported from Excel - ${excelAccrual.kdAkr}${excelAccrual.klasifikasi ? ` (${excelAccrual.klasifikasi})` : ''}`,
              klasifikasi: excelAccrual.klasifikasi ?? null,
              totalAmount: excelAccrual.totalAmount ?? excelAccrual.saldo,
              noPo: excelAccrual.noPo ?? null,
              alokasi: excelAccrual.alokasi ?? null,
              startDate: new Date(),
              jumlahPeriode: 1,
              pembagianType: 'otomatis',
              periodes: {
                create: {
                  periodeKe: 1,
                  bulan: `${new Date().toLocaleDateString('id-ID', { month: 'short' })} ${new Date().getFullYear()}`,
                  tahun: new Date().getFullYear(),
                  amountAccrual: excelAccrual.saldo,
                },
              },
            },
            include: { periodes: true },
          });

          results.push({
            kdAkr: excelAccrual.kdAkr,
            noPo: excelAccrual.noPo,
            vendor: excelAccrual.vendor,
            klasifikasi: excelAccrual.klasifikasi,
            action: 'created',
            saldo: excelAccrual.saldo,
            id: newAccrual.id,
          });
        }
      } catch (error) {
        processedErrors.push({
          kdAkr: excelAccrual.kdAkr,
          noPo: excelAccrual.noPo,
          vendor: excelAccrual.vendor,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: `Successfully processed ${results.length} accruals`,
      results,
      errors: processedErrors,
      warnings: errors
    });

  } catch (error) {
    console.error('Error importing Excel file:', error);
    return NextResponse.json(
      { error: 'Failed to import Excel file', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
