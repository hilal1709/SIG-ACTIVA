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

    // Process each accrual and create/update records
    const results = [];
    const processedErrors = [];

    for (const excelAccrual of accruals) {
      try {
        // Check if accrual already exists
        const existingAccrual = await prisma.accrual.findFirst({
          where: {
            kdAkr: excelAccrual.kdAkr
          }
        });

        if (existingAccrual) {
          // Update existing accrual's total amount
          const updatedAccrual = await prisma.accrual.update({
            where: { id: existingAccrual.id },
            data: {
              totalAmount: excelAccrual.saldo,
              // Update other fields if provided
              ...(excelAccrual.vendor && { vendor: excelAccrual.vendor }),
              ...(excelAccrual.deskripsi && { deskripsi: excelAccrual.deskripsi }),
              ...(excelAccrual.kdAkunBiaya && { kdAkunBiaya: excelAccrual.kdAkunBiaya }),
            },
            include: {
              periodes: true
            }
          });

          // Update periodes to match new total
          if (updatedAccrual.periodes.length > 0) {
            const amountPerPeriode = excelAccrual.saldo / updatedAccrual.periodes.length;
            
            await prisma.accrualPeriode.updateMany({
              where: {
                accrualId: existingAccrual.id
              },
              data: {
                amountAccrual: amountPerPeriode
              }
            });
          }

          results.push({
            kdAkr: excelAccrual.kdAkr,
            action: 'updated',
            saldo: excelAccrual.saldo,
            id: existingAccrual.id
          });
        } else {
          // Create new accrual with default values
          const newAccrual = await prisma.accrual.create({
            data: {
              kdAkr: excelAccrual.kdAkr,
              kdAkunBiaya: excelAccrual.kdAkunBiaya || 'DEFAULT',
              vendor: excelAccrual.vendor || 'IMPORTED FROM EXCEL',
              deskripsi: excelAccrual.deskripsi || `Imported from Excel - ${excelAccrual.kdAkr}`,
              totalAmount: excelAccrual.saldo,
              startDate: new Date(),
              jumlahPeriode: 1,
              pembagianType: 'otomatis',
              periodes: {
                create: {
                  periodeKe: 1,
                  bulan: `${new Date().toLocaleDateString('id-ID', { month: 'short' })} ${new Date().getFullYear()}`,
                  tahun: new Date().getFullYear(),
                  amountAccrual: excelAccrual.saldo,
                }
              }
            },
            include: {
              periodes: true
            }
          });

          results.push({
            kdAkr: excelAccrual.kdAkr,
            action: 'created',
            saldo: excelAccrual.saldo,
            id: newAccrual.id
          });
        }
      } catch (error) {
        processedErrors.push({
          kdAkr: excelAccrual.kdAkr,
          error: error instanceof Error ? error.message : 'Unknown error'
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
