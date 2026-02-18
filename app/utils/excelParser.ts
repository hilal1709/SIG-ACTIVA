import * as XLSX from 'xlsx';
import { keteranganToKlasifikasi, isRekapSummaryRow, getDetailKlasifikasiList } from './accrualKlasifikasi';

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
  /** Hanya untuk internal parser: baris "BIAYA YMH ..." (summary) di REKAP */
  isSummaryRow?: boolean;
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
            let lastKdAkr = ''; // Untuk sub-row: baris dengan AKUN kosong pakai kode akun baris sebelumnya
            for (let i = headerIndex + 1; i < data.length; i++) {
              const row = data[i];
              if (!row || row.length === 0) continue;

              const kdAkr = row[akunColumn];
              const saldoAkhir = row[saldoAkhirColumn];
              let kdAkrStr = kdAkr != null && String(kdAkr).trim() !== '' ? String(kdAkr).trim() : '';
              const saldoValue = parseNumber(saldoAkhir);
              const rawKeterangan =
                keteranganColumn !== -1 &&
                row[keteranganColumn] != null &&
                row[keteranganColumn] !== ''
                  ? String(row[keteranganColumn]).trim()
                  : '';

              // Sub-row: AKUN kosong tapi ada KETERANGAN + SALDO → pakai kode akun baris sebelumnya (detail Gaji/Cuti Tahunan dll)
              if (!kdAkrStr && rawKeterangan && saldoValue !== null && lastKdAkr) {
                kdAkrStr = lastKdAkr;
              }
              if (kdAkrStr) {
                kdAkrStr = normalizeKodeAkr(kdAkrStr) || kdAkrStr;
                rekapKodeAkunSet.add(kdAkrStr);
                lastKdAkr = kdAkrStr;
              }

              // Setiap baris REKAP dimasukkan; baris summary "BIAYA YMH ..." ditandai (nanti di-filter jika ada baris detail)
              if (kdAkrStr && saldoValue !== null) {
                const isSummary = isRekapSummaryRow(kdAkrStr, rawKeterangan);
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
                  isSummaryRow: isSummary,
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

    // Untuk kode akun yang punya detail: jika ada baris detail (bukan summary), buang semua baris summary agar YMH tidak tampil (21600001 hanya Gaji + Cuti Tahunan)
    const rekapRowsFiltered = rekapRows.filter((r) => {
      if (!r.isSummaryRow) return true;
      const details = getDetailKlasifikasiList(r.kdAkr);
      if (!details) return true; // kode tanpa detail: tetap tampilkan summary
      const hasDetailRow = rekapRows.some((x) => x.kdAkr === r.kdAkr && !x.isSummaryRow);
      return !hasDetailRow; // buang summary hanya kalau ada baris detail
    });
    // Hapus flag internal sebelum dipakai
    const rekapRowsFinal = rekapRowsFiltered.map(({ isSummaryRow, ...rest }) => rest);

    // Daftar sheet yang namanya kode akun (punya sheet sendiri)
    const kodeAkunSheetNames = sheetNames.filter((name) => {
      const trimmed = String(name ?? '').trim();
      return trimmed.toUpperCase() !== 'REKAP' && /^\d+$/.test(trimmed);
    });

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
              // Untuk sheet: amount pakai NILAI PO kalau ada, else OUTSTANDING. Vendor kosong tetap dipass (null) supaya baris tetap punya record sendiri.
              const kdAkrNormalized = normalizeKodeAkr(String(sheetName ?? '').trim()) || String(sheetName ?? '').trim();
              accruals.push({
                kdAkr: kdAkrNormalized,
                saldo: outstandingValue,
                ...(klasifikasiValue ? { klasifikasi: klasifikasiValue } : {}),
                vendor: vendorValue || null,
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

    // ---- 3) REKAP: hanya skip kalau kode akun BENAR-BENAR dapat data dari sheet-nya
    // Kalau kode akun punya sheet tapi sheet kosong/salah format, tetap ambil dari REKAP supaya tidak ada kode akun yang hilang
    const kdAkrWithSheetData = new Set(accruals.map((a) => a.kdAkr));
    for (const r of rekapRowsFinal) {
      if (kdAkrWithSheetData.has(r.kdAkr)) continue; // sudah dapat data dari sheet, lewati REKAP
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

/** Normalisasi kode akun dari Excel (angka bisa kehilangan leading zero): 2160005 → 21600005, 216000019 → 21600019 */
function normalizeKodeAkr(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = String(value).trim().replace(/\s/g, '');
  if (!s) return '';
  const num = Number(s);
  if (Number.isFinite(num)) {
    if (num >= 21600000 && num <= 21699999) return String(num);
    if (num >= 2160000 && num <= 2169999) return String(num).padStart(8, '0');
    if (num >= 216000000 && num <= 216999999) return '216' + String(num % 1000000).padStart(5, '0');
  }
  if (/^\d{7,9}$/.test(s)) {
    if (s.length === 8) return s;
    if (s.length === 7) return s.padStart(8, '0');
    if (s.length === 9 && s.startsWith('2160')) return s.slice(0, 3) + s.slice(4);
  }
  return s;
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
