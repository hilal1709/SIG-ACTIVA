import * as XLSX from 'xlsx';

export interface ExcelAccrualData {
  kdAkr: string;
  saldo: number;
  klasifikasi?: string;
  vendor?: string;
  deskripsi?: string;
  kdAkunBiaya?: string;
  noPo?: string;
  alokasi?: string;
  totalAmount?: number;
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
        
        // Find header row (sometimes it isn't first row)
        const headerSearchRows = data.slice(0, 25);
        const headerRow =
          headerSearchRows.find((row) => {
            const kodeAkunColumn = findColumnIndex(row, ['KODE AKUN', 'KODE', 'KD AKR', 'KDAKR']);
            const outstandingColumn = findColumnIndex(row, ['OUTSTANDING', 'SALDO AKHIR', 'SALDO']);
            return kodeAkunColumn !== -1 && outstandingColumn !== -1;
          }) ??
          data[0];

        // Find columns based on export format
        const kodeAkunColumn = findColumnIndex(headerRow, ['KODE AKUN', 'KODE', 'KD AKR', 'KDAKR']);
        const klasifikasiColumn = findColumnIndex(headerRow, ['KLASIFIKASI', 'PEKERJAAN']);
        const vendorColumn = findColumnIndex(headerRow, ['VENDOR', 'NAMA VENDOR']);
        const noPoColumn = findColumnIndex(headerRow, ['PO/PR', 'PO', 'NO PO', 'PR']);
        const alokasiColumn = findColumnIndex(headerRow, ['ORDER', 'ALOKASI']);
        const keteranganColumn = findColumnIndex(headerRow, ['KETERANGAN', 'DESKRIPSI']);
        const nilaiPoColumn = findColumnIndex(headerRow, ['NILAI PO', 'TOTAL AMOUNT', 'AMOUNT']);
        const outstandingColumn = findColumnIndex(headerRow, ['OUTSTANDING', 'SALDO AKHIR', 'SALDO']);
        
        if (kodeAkunColumn !== -1 && outstandingColumn !== -1) {
          // Look for the last row with data (typically the balance)
          let lastBalance = 0;
          let lastKlasifikasi = '';
          let lastVendor = '';
          let lastNoPo = '';
          let lastAlokasi = '';
          let lastKeterangan = '';
          let lastNilaiPo = 0;
          
          const startRowIndex = Math.max(0, data.indexOf(headerRow) + 1);
          for (let i = startRowIndex; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            const outstandingValue = parseNumber(row[outstandingColumn]);
            if (outstandingValue !== null) {
              lastBalance = outstandingValue;
            }
            
            // Capture other fields from the last non-empty row
            if (klasifikasiColumn !== -1 && row[klasifikasiColumn]) {
              lastKlasifikasi = String(row[klasifikasiColumn]).trim();
            }
            if (vendorColumn !== -1 && row[vendorColumn]) {
              lastVendor = String(row[vendorColumn]).trim();
            }
            if (noPoColumn !== -1 && row[noPoColumn]) {
              lastNoPo = String(row[noPoColumn]).trim();
            }
            if (alokasiColumn !== -1 && row[alokasiColumn]) {
              lastAlokasi = String(row[alokasiColumn]).trim();
            }
            if (keteranganColumn !== -1 && row[keteranganColumn]) {
              lastKeterangan = String(row[keteranganColumn]).trim();
            }
            if (nilaiPoColumn !== -1) {
              const nilaiPoValue = parseNumber(row[nilaiPoColumn]);
              if (nilaiPoValue !== null) {
                lastNilaiPo = nilaiPoValue;
              }
            }
          }
          
          // Allow negative/positive saldo; ignore exact zero
          if (lastBalance !== 0) {
            accruals.push({
              kdAkr: String(sheetName ?? '').trim(),
              saldo: lastBalance,
              ...(lastKlasifikasi ? { klasifikasi: lastKlasifikasi } : {}),
              ...(lastVendor ? { vendor: lastVendor } : {}),
              ...(lastNoPo ? { noPo: lastNoPo } : {}),
              ...(lastAlokasi ? { alokasi: lastAlokasi } : {}),
              ...(lastKeterangan ? { deskripsi: lastKeterangan } : {}),
              ...(lastNilaiPo !== 0 ? { totalAmount: lastNilaiPo } : {})
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
            const akunColumn = findColumnIndex(row, [
              'AKUN',
              'KODE',
              'KODE AKR',
              'KODE AKRUAL',
              'KD AKR',
              'KDAKR',
              'AKRUAL'
            ]);
            const keteranganColumn = findColumnIndex(row, [
              'KETERANGAN',
              'KLASIFIKASI',
              'DESKRIPSI'
            ]);
            const saldoAkhirColumn = findColumnIndex(row, ['SALDO AKHIR', 'SALDOAKHIR', 'OUTSTANDING', 'SALDO']);
            return akunColumn !== -1 && keteranganColumn !== -1 && saldoAkhirColumn !== -1;
          }) ?? null;
        
        if (headerRow) {
          const headerIndex = data.indexOf(headerRow);
          const akunColumn = findColumnIndex(headerRow, [
            'AKUN',
            'KODE',
            'KODE AKR',
            'KODE AKRUAL',
            'KD AKR',
            'KDAKR',
            'AKRUAL'
          ]);
          const keteranganColumn = findColumnIndex(headerRow, [
            'KETERANGAN',
            'KLASIFIKASI',
            'DESKRIPSI'
          ]);
          const saldoAkhirColumn = findColumnIndex(headerRow, ['SALDO AKHIR', 'SALDOAKHIR', 'OUTSTANDING', 'SALDO']);
          const vendorColumn = findColumnIndex(headerRow, [
            'VENDOR',
            'NAMA VENDOR',
            'NAMA SUPPLIER',
            'SUPPLIER'
          ]);
          const kdAkunBiayaColumn = findColumnIndex(headerRow, [
            'KD AKUN BIAYA',
            'KODE AKUN BIAYA',
            'AKUN BIAYA'
          ]);
          if (akunColumn !== -1 && keteranganColumn !== -1 && saldoAkhirColumn !== -1) {
            // Process data rows
            for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;
              
              const kdAkr = row[akunColumn];
              const saldoAkhir = row[saldoAkhirColumn];
              
              const kdAkrStr = kdAkr ? String(kdAkr).trim() : '';
              const saldoValue = parseNumber(saldoAkhir);
              const klasifikasiValue =
                keteranganColumn !== -1 && row[keteranganColumn] !== null && row[keteranganColumn] !== undefined
                  ? String(row[keteranganColumn]).trim()
                  : undefined;
              const vendorValue =
                vendorColumn !== -1 && row[vendorColumn] !== null && row[vendorColumn] !== undefined
                  ? String(row[vendorColumn]).trim()
                  : undefined;
              const kdAkunBiayaValue =
                kdAkunBiayaColumn !== -1 && row[kdAkunBiayaColumn] !== null && row[kdAkunBiayaColumn] !== undefined
                  ? String(row[kdAkunBiayaColumn]).trim()
                  : undefined;
                  
              if (kdAkrStr && saldoValue !== null) {
                
                // Only add if not already processed from individual sheet
                // Allow negative/positive saldo; ignore exact zero
                if (!accruals.find(a => a.kdAkr === kdAkrStr) && saldoValue !== 0) {
                  accruals.push({
                    kdAkr: kdAkrStr,
                    saldo: saldoValue,
                    ...(klasifikasiValue ? { klasifikasi: klasifikasiValue } : {}),
                    ...(vendorValue ? { vendor: vendorValue } : {}),
                    ...(kdAkunBiayaValue ? { kdAkunBiaya: kdAkunBiayaValue } : {})
                  });
                }
              }
            }
          } else {
            errors.push(
              `Sheet ${rekapSheetName}: header ditemukan tapi kolom AKUN/KETERANGAN/SALDO tidak lengkap`
            );
          }
        } else {
          errors.push(`Sheet ${rekapSheetName}: header tidak ditemukan (butuh kolom AKUN + KETERANGAN + SALDO AKHIR/OUTSTANDING/SALDO)`);
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
  if (raw === '-' || raw.toUpperCase() === 'N/A') return null;

  // Parentheses mean negative in accounting formats: (1.234) => -1234
  const isParenNegative = raw.startsWith('(') && raw.endsWith(')');
  const rawWithoutParens = isParenNegative ? raw.slice(1, -1) : raw;

  // Remove currency/space and keep digits, separators, minus
  const cleaned = rawWithoutParens
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
  if (!Number.isFinite(num)) return null;
  return isParenNegative ? -Math.abs(num) : num;
}
