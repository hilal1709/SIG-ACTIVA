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
    const accrualCodeSheets = sheetNames.filter((name) => {
      const trimmed = String(name ?? '').trim();
      return trimmed.toUpperCase() !== 'REKAP' && /^\d+$/.test(trimmed);
    });
    
    for (const sheetName of accrualCodeSheets) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
        
        // Find the header row (sometimes it isn't the first row)
        const headerSearchRows = data.slice(0, 25);
        const headerRow =
          headerSearchRows.find((row) => findColumnIndex(row, ['OUTSTANDING', 'SALDO AKHIR', 'SALDO']) !== -1) ??
          data[0];

        // Find the outstanding/saldo column and data rows
        const outstandingColumn = findColumnIndex(headerRow, ['OUTSTANDING', 'SALDO AKHIR', 'SALDO']);
        
        if (outstandingColumn !== -1) {
          // Look for the last row with data (typically the balance)
          let lastBalance = 0;
          const startRowIndex = Math.max(0, data.indexOf(headerRow) + 1);
          for (let i = startRowIndex; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            const value = parseNumber(row[outstandingColumn]);
            if (value !== null) {
              lastBalance = value;
            }
          }
          
          if (lastBalance > 0) {
            accruals.push({
              kdAkr: String(sheetName ?? '').trim(),
              saldo: lastBalance
            });
          }
        } else {
          errors.push(
            `Sheet ${String(sheetName ?? '').trim()}: kolom saldo tidak ditemukan (cari: OUTSTANDING / SALDO AKHIR / SALDO)`
          );
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
        
        // Find header row: must contain BOTH kdAkr and saldo columns
        const headerSearchRows = data.slice(0, 50);
        const headerRow =
          headerSearchRows.find((row) => {
            const kdAkrColumn = findColumnIndex(row, ['KODE', 'KODE AKR', 'KODE AKRUAL', 'KD AKR', 'KDAKR', 'AKRUAL']);
            const saldoAkhirColumn = findColumnIndex(row, ['SALDO AKHIR', 'SALDOAKHIR', 'OUTSTANDING', 'SALDO']);
            return kdAkrColumn !== -1 && saldoAkhirColumn !== -1;
          }) ?? null;
        
        if (headerRow) {
          const headerIndex = data.indexOf(headerRow);
          const kdAkrColumn = findColumnIndex(headerRow, ['KODE', 'KODE AKR', 'KODE AKRUAL', 'KD AKR', 'KDAKR', 'AKRUAL']);
          const saldoAkhirColumn = findColumnIndex(headerRow, ['SALDO AKHIR', 'SALDOAKHIR', 'OUTSTANDING', 'SALDO']);
          
          if (kdAkrColumn !== -1 && saldoAkhirColumn !== -1) {
            // Process data rows
            for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;
              
              const kdAkr = row[kdAkrColumn];
              const saldoAkhir = row[saldoAkhirColumn];
              
              const kdAkrStr = kdAkr ? String(kdAkr).trim() : '';
              const saldoValue = parseNumber(saldoAkhir);
              if (kdAkrStr && saldoValue !== null) {
                
                // Only add if not already processed from individual sheet
                if (!accruals.find(a => a.kdAkr === kdAkrStr) && saldoValue > 0) {
                  accruals.push({
                    kdAkr: kdAkrStr,
                    saldo: saldoValue
                  });
                }
              }
            }
          } else {
            errors.push(
              `Sheet ${rekapSheetName}: header ditemukan tapi kolom KODE/SALDO tidak lengkap`
            );
          }
        } else {
          errors.push(`Sheet ${rekapSheetName}: header tidak ditemukan (butuh kolom KODE + SALDO AKHIR/OUTSTANDING/SALDO)`);
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

function parseNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  // Remove currency/space and keep digits, separators, minus
  const cleaned = raw
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return null;

  // Heuristic:
  // - If both '.' and ',' exist: assume '.' thousands and ',' decimal -> remove '.' then replace ',' with '.'
  // - If only ',' exists: assume ',' decimal -> replace with '.'
  // - Else: parse as-is (handles "1234" or "1234.56")
  let normalized = cleaned;
  if (cleaned.includes('.') && cleaned.includes(',')) {
    normalized = cleaned.replace(/\./g, '').replace(/,/g, '.');
  } else if (cleaned.includes(',') && !cleaned.includes('.')) {
    normalized = cleaned.replace(/,/g, '.');
  }

  const num = Number(normalized);
  return Number.isFinite(num) ? num : null;
}
