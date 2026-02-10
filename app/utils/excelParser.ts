import * as XLSX from 'xlsx';

export interface ExcelAccrualData {
  kdAkr: string;
  saldo: number;
  vendor?: string;
  deskripsi?: string;
  kdAkunBiaya?: string;
}

export interface ParsedExcelData {
  accruals: ExcelAccrualData[];
  errors: string[];
}

export function parseExcelFile(buffer: ArrayBuffer): ParsedExcelData {
  try {
    const workbook = XLSX.read(buffer, { type: 'array' });
    const sheetNames = workbook.SheetNames;
    
    const accruals: ExcelAccrualData[] = [];
    const errors: string[] = [];
    
    // Process sheets named with accrual codes first
    const accrualCodeSheets = sheetNames.filter(name => 
      name !== 'REKAP' && name !== 'rekap' && /^\d+$/.test(name)
    );
    
    for (const sheetName of accrualCodeSheets) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find the outstanding/saldo column and data rows
        const outstandingColumn = findColumnIndex(data[0], ['OUTSTANDING', 'outstanding', 'SALDO', 'saldo']);
        
        if (outstandingColumn !== -1) {
          // Look for the last row with data (typically the balance)
          let lastBalance = 0;
          for (let i = 1; i < data.length; i++) {
            const row = data[i];
            if (row && row[outstandingColumn] && !isNaN(parseFloat(row[outstandingColumn]))) {
              lastBalance = parseFloat(row[outstandingColumn]);
            }
          }
          
          if (lastBalance > 0) {
            accruals.push({
              kdAkr: sheetName,
              saldo: lastBalance
            });
          }
        }
      } catch (error) {
        errors.push(`Error processing sheet ${sheetName}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    // Process REKAP sheet for remaining accruals
    const rekapSheetName = sheetNames.find(name => 
      name.toUpperCase() === 'REKAP'
    );
    
    if (rekapSheetName) {
      try {
        const worksheet = workbook.Sheets[rekapSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find header row with relevant columns
        const headerRow = data.find(row => 
          row && row.some((cell: any) => 
            typeof cell === 'string' && (
              cell.toUpperCase().includes('KODE') || 
              cell.toUpperCase().includes('SALDO AKHIR') ||
              cell.toUpperCase().includes('SALDOAKHIR')
            )
          )
        );
        
        if (headerRow) {
          const headerIndex = data.indexOf(headerRow);
          const kdAkrColumn = findColumnIndex(headerRow, ['KODE', 'KODE AKR', 'KD AKR', 'KDAKR']);
          const saldoAkhirColumn = findColumnIndex(headerRow, ['SALDO AKHIR', 'SALDOAKHIR', 'SALDO']);
          
          if (kdAkrColumn !== -1 && saldoAkhirColumn !== -1) {
            // Process data rows
            for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;
              
              const kdAkr = row[kdAkrColumn];
              const saldoAkhir = row[saldoAkhirColumn];
              
              if (kdAkr && saldoAkhir && !isNaN(parseFloat(saldoAkhir))) {
                const kdAkrStr = String(kdAkr).trim();
                const saldoValue = parseFloat(saldoAkhir);
                
                // Only add if not already processed from individual sheet
                if (!accruals.find(a => a.kdAkr === kdAkrStr) && saldoValue > 0) {
                  accruals.push({
                    kdAkr: kdAkrStr,
                    saldo: saldoValue
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        errors.push(`Error processing REKAP sheet: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    return {
      accruals,
      errors
    };
  } catch (error) {
    return {
      accruals: [],
      errors: [`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`]
    };
  }
}

function findColumnIndex(headerRow: any[], possibleNames: string[]): number {
  if (!headerRow) return -1;
  
  for (const name of possibleNames) {
    const index = headerRow.findIndex(cell => 
      cell && typeof cell === 'string' && cell.toUpperCase().includes(name.toUpperCase())
    );
    if (index !== -1) return index;
  }
  return -1;
}
