import * as XLSX from 'xlsx';
import { keteranganToKlasifikasi, getDetailKlasifikasiList } from './accrualKlasifikasi';

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
  /** Asal data: 'sheet' = sheet kode akun, 'rekap' = sheet REKAP */
  source?: 'sheet' | 'rekap';
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

    // ---- 1) Baca REKAP dulu: dapatkan daftar kode akun yang ada di REKAP + semua baris REKAP ----
    const rekapSheetName = sheetNames.find((name) => String(name).trim().toUpperCase() === 'REKAP');
    const rekapKodeAkunSet = new Set<string>();
    const rekapRows: ExcelAccrualData[] = [];

    if (rekapSheetName) {
      try {
        const worksheet = workbook.Sheets[rekapSheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        const headerSearchRows = data.slice(0, 50);
        const headerRow = headerSearchRows.find((row) => {
          const akunColumn = findColumnIndex(row, [
            'AKUN',
            'KODE',
            'KODE AKR',
            'KODE AKRUAL',
            'KD AKR',
            'KDAKR',
            'AKRUAL',
          ]);
          const keteranganColumn = findColumnIndex(row, [
            'KETERANGAN',
            'KLASIFIKASI',
            'DESKRIPSI',
          ]);
          const saldoAkhirColumn = findColumnIndex(row, [
            'SALDO AKHIR',
            'SALDOAKHIR',
            'OUTSTANDING',
            'SALDO',
          ]);
          return (
            akunColumn !== -1 &&
            keteranganColumn !== -1 &&
            saldoAkhirColumn !== -1
          );
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
            'AKRUAL',
          ]);
          const keteranganColumn = findColumnIndex(headerRow, [
            'KETERANGAN',
            'KLASIFIKASI',
            'DESKRIPSI',
          ]);
          const saldoAkhirColumn = findColumnIndex(headerRow, [
            'SALDO AKHIR',
            'SALDOAKHIR',
            'OUTSTANDING',
            'SALDO',
          ]);
          const vendorColumn = findColumnIndex(headerRow, [
            'VENDOR',
            'NAMA VENDOR',
            'NAMA SUPPLIER',
            'SUPPLIER',
          ]);
          const kdAkunBiayaColumn = findColumnIndex(headerRow, [
            'KD AKUN BIAYA',
            'KODE AKUN BIAYA',
            'AKUN BIAYA',
          ]);

          if (
            akunColumn !== -1 &&
            keteranganColumn !== -1 &&
            saldoAkhirColumn !== -1
          ) {
            for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;

              const kdAkr = row[akunColumn];
              const saldoAkhir = row[saldoAkhirColumn];
              const kdAkrStr = kdAkr ? String(kdAkr).trim() : '';
              const saldoValue = parseNumber(saldoAkhir);
              const rawKeterangan =
                keteranganColumn !== -1 &&
                row[keteranganColumn] != null &&
                row[keteranganColumn] !== ''
                  ? String(row[keteranganColumn]).trim()
                  : '';

              if (kdAkrStr) {
                rekapKodeAkunSet.add(kdAkrStr);
              }

              // Setiap baris REKAP dimasukkan; keterangan disesuaikan ke klasifikasi (strip BIAYA YMH, cocok ke klasifikasi)
              // Nilai saldo mengikuti file: positif/negatif tidak diubah
              if (kdAkrStr && saldoValue !== null) {
                const klasifikasiNormalized = rawKeterangan
                  ? keteranganToKlasifikasi(kdAkrStr, rawKeterangan)
                  : undefined;
                const vendorValue =
                  vendorColumn !== -1 && row[vendorColumn] != null
                    ? String(row[vendorColumn]).trim()
                    : undefined;
                const kdAkunBiayaValue =
                  kdAkunBiayaColumn !== -1 && row[kdAkunBiayaColumn] != null
                    ? String(row[kdAkunBiayaColumn]).trim()
                    : undefined;

                rekapRows.push({
                  kdAkr: kdAkrStr,
                  saldo: saldoValue,
                  ...(klasifikasiNormalized
                    ? { klasifikasi: klasifikasiNormalized }
                    : rawKeterangan
                      ? { klasifikasi: rawKeterangan }
                      : {}),
                  ...(vendorValue ? { vendor: vendorValue } : {}),
                  ...(kdAkunBiayaValue
                    ? { kdAkunBiaya: kdAkunBiayaValue }
                    : {}),
                  source: 'rekap',
                });
              }
            }
          } else {
            errors.push(
              `Sheet ${rekapSheetName}: header ditemukan tapi kolom AKUN/KETERANGAN/SALDO tidak lengkap`
            );
          }
        } else {
          errors.push(
            `Sheet ${rekapSheetName}: header tidak ditemukan (butuh kolom AKUN + KETERANGAN + SALDO AKHIR/OUTSTANDING/SALDO)`
          );
        }
      } catch (error) {
        errors.push(
          `Error processing REKAP sheet: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Daftar sheet yang namanya kode akun (punya sheet sendiri)
    const kodeAkunSheetNames = sheetNames.filter((name) => {
      const trimmed = String(name ?? '').trim();
      return trimmed.toUpperCase() !== 'REKAP' && /^\d+$/.test(trimmed);
    });
    const hasOwnSheetSet = new Set(kodeAkunSheetNames);

    // ---- 2) Proses semua sheet yang namanya kode akun accrual (banyak baris per sheet) ----
    const outstandingPossibleNames = [
      'OUTSTANDING',
      'OUSTANDING', // typo umum di Excel
      'SALDO AKHIR',
      'SALDOAKHIR',
      'SALDO',
    ];

    for (const sheetName of kodeAkunSheetNames) {
      try {
        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, {
          header: 1,
        }) as any[][];

        // Cari baris header: cukup ada kolom saldo (nama sheet = kode akun, tidak wajib kolom KODE AKUN)
        const headerSearchRows = data.slice(0, 40);
        const headerRow =
          headerSearchRows.find((row) => {
            const outstandingColumn = findColumnIndex(row, outstandingPossibleNames);
            return outstandingColumn !== -1;
          }) ?? data[0];

        const klasifikasiColumn = findColumnIndex(headerRow, [
          'KLASIFIKASI',
          'PEKERJAAN',
        ]);
        const vendorColumn = findColumnIndex(headerRow, [
          'VENDOR',
          'NAMA VENDOR',
        ]);
        const noPoColumn = findColumnIndex(headerRow, [
          'PO/PR',
          'PO',
          'NO PO',
          'PR',
        ]);
        const alokasiColumn = findColumnIndex(headerRow, ['ORDER', 'ALOKASI']);
        const keteranganColumn = findColumnIndex(headerRow, [
          'KETERANGAN',
          'DESKRIPSI',
        ]);
        const nilaiPoColumn = findColumnIndex(headerRow, [
          'NILAI PO',
          'TOTAL AMOUNT',
          'AMOUNT',
        ]);
        const outstandingColumn = findColumnIndex(headerRow, outstandingPossibleNames);

        if (outstandingColumn !== -1) {
          const startRowIndex = Math.max(0, data.indexOf(headerRow) + 1);
          for (let i = startRowIndex; i < data.length; i++) {
            const row = data[i];
            if (!row) continue;

            const outstandingValue = parseNumber(row[outstandingColumn]);
            const klasifikasiValue =
              klasifikasiColumn !== -1 && row[klasifikasiColumn]
                ? String(row[klasifikasiColumn]).trim()
                : '';
            const vendorValue =
              vendorColumn !== -1 && row[vendorColumn]
                ? String(row[vendorColumn]).trim()
                : '';
            const noPoValue =
              noPoColumn !== -1 && row[noPoColumn]
                ? String(row[noPoColumn]).trim()
                : '';
            const alokasiValue =
              alokasiColumn !== -1 && row[alokasiColumn]
                ? String(row[alokasiColumn]).trim()
                : '';
            const keteranganValue =
              keteranganColumn !== -1 && row[keteranganColumn]
                ? String(row[keteranganColumn]).trim()
                : '';
            const nilaiPoValue =
              nilaiPoColumn !== -1 ? parseNumber(row[nilaiPoColumn]) : null;

            if (outstandingValue !== null && outstandingValue !== 0) {
              // Nilai saldo dan totalAmount mengikuti file: positif/negatif tidak diubah
              accruals.push({
                kdAkr: String(sheetName ?? '').trim(),
                saldo: outstandingValue,
                ...(klasifikasiValue ? { klasifikasi: klasifikasiValue } : {}),
                ...(vendorValue ? { vendor: vendorValue } : {}),
                ...(noPoValue ? { noPo: noPoValue } : {}),
                ...(alokasiValue ? { alokasi: alokasiValue } : {}),
                ...(keteranganValue ? { deskripsi: keteranganValue } : {}),
                ...(nilaiPoValue != null && nilaiPoValue !== 0
                  ? { totalAmount: nilaiPoValue }
                  : {}),
                source: 'sheet',
              });
            }
          }
        } else {
          errors.push(
            `Sheet ${String(sheetName ?? '').trim()}: kolom saldo tidak ditemukan (cari: OUTSTANDING / OUSTANDING / SALDO AKHIR / SALDO)`
          );
        }
      } catch (error) {
        errors.push(
          `Error processing sheet ${sheetName}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // ---- 2.5) Expand baris REKAP untuk kode akun yang punya detail ----
    // Kondisi 1: kode akun tanpa detail (21600002-21600007): 1 baris tetap 1 baris.
    // Kondisi 2: kode akun dengan detail (21600001, 21600008): jika hanya 1 baris untuk kdAkr tersebut,
    //             pecah jadi N baris (satu per detail), saldo dibagi rata.
    const rekapRowsExpanded: ExcelAccrualData[] = [];
    const rekapByKdAkr = new Map<string, ExcelAccrualData[]>();
    for (const r of rekapRows) {
      const list = rekapByKdAkr.get(r.kdAkr) ?? [];
      list.push(r);
      rekapByKdAkr.set(r.kdAkr, list);
    }
    for (const [kdAkr, rows] of rekapByKdAkr) {
      const detailList = getDetailKlasifikasiList(kdAkr);
      if (detailList && detailList.length > 1 && rows.length === 1) {
        const single = rows[0];
        const saldoPerBaris = single.saldo / detailList.length;
        for (const klasifikasi of detailList) {
          rekapRowsExpanded.push({
            ...single,
            klasifikasi,
            saldo: saldoPerBaris,
          });
        }
      } else {
        rekapRowsExpanded.push(...rows);
      }
    }

    // ---- 3) REKAP hanya untuk kode akun yang TIDAK punya sheet sendiri ----
    for (const r of rekapRowsExpanded) {
      if (hasOwnSheetSet.has(r.kdAkr)) continue; // sudah ada datanya dari sheet, lewati
      accruals.push(r);
    }

    return {
      accruals,
      errors,
    };
  } catch (error) {
    return {
      accruals: [],
      errors: [
        `Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`,
      ],
    };
  }
}

function findColumnIndex(
  headerRow: any[],
  possibleNames: string[]
): number {
  if (!headerRow) return -1;

  for (const name of possibleNames) {
    const nameUpper = name.toUpperCase();
    const index = headerRow.findIndex((cell) => {
      const s = cell != null ? String(cell).trim() : '';
      return s.toUpperCase().includes(nameUpper);
    });
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

  const isParenNegative =
    raw.startsWith('(') && raw.endsWith(')');
  const rawWithoutParens = isParenNegative
    ? raw.slice(1, -1)
    : raw;

  const cleaned = rawWithoutParens
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '');

  if (!cleaned) return null;

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
