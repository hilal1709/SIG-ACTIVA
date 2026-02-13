import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { parseExcelFile, ExcelAccrualData } from '@/app/utils/excelParser';

// Vercel function timeout: 300 detik (5 menit) untuk Pro plan, atau sesuai kebutuhan
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

    // Optimasi: Batch processing dengan chunk untuk menghindari timeout
    const BATCH_SIZE = 50; // Proses 50 baris sekaligus
    const results: any[] = [];
    const processedErrors: any[] = [];

    // Proses dalam batch untuk menghindari timeout
    for (let i = 0; i < accruals.length; i += BATCH_SIZE) {
      const batch = accruals.slice(i, i + BATCH_SIZE);
      
      // Process batch secara parallel (maksimal 50 concurrent operations)
      const batchPromises = batch.map(async (excelAccrual) => {
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

            return {
              kdAkr: excelAccrual.kdAkr,
              noPo: excelAccrual.noPo,
              vendor: excelAccrual.vendor,
              klasifikasi: excelAccrual.klasifikasi,
              action: 'updated',
              saldo: excelAccrual.saldo,
              id: existingAccrual.id,
            };
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

            return {
              kdAkr: excelAccrual.kdAkr,
              noPo: excelAccrual.noPo,
              vendor: excelAccrual.vendor,
              klasifikasi: excelAccrual.klasifikasi,
              action: 'created',
              saldo: excelAccrual.saldo,
              id: newAccrual.id,
            };
          }
        } catch (error) {
          return {
            error: true,
            kdAkr: excelAccrual.kdAkr,
            noPo: excelAccrual.noPo,
            vendor: excelAccrual.vendor,
            errorMessage: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      });

      // Tunggu batch selesai sebelum lanjut ke batch berikutnya
      const batchResults = await Promise.all(batchPromises);
      
      // Pisahkan hasil dan error
      for (const result of batchResults) {
        if (result.error) {
          processedErrors.push({
            kdAkr: result.kdAkr,
            noPo: result.noPo,
            vendor: result.vendor,
            error: result.errorMessage,
          });
        } else {
          results.push(result);
        }
      }

      // Log progress untuk monitoring
      console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(accruals.length / BATCH_SIZE)}: ${results.length} success, ${processedErrors.length} errors`);
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
