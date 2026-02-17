'use client';

import { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Header from '../components/Header';
import { Upload, FileSpreadsheet, Download } from 'lucide-react';

type FluktuasiRow = {
  [key: string]: any;
  __sheetName: string;
  __rowIndex: number;
  fluktuasiRp?: number;
  fluktuasiPersen?: number;
  reason?: string;
};

type RekapRow = {
  sheetName: string;
  totalFluktuasi: number;
  avgFluktuasi: number;
  maxFluktuasi: number;
  minFluktuasi: number;
  reason: string;
};

// Lazy load XLSX on demand (reuse pattern from ExcelImport)
let XLSX: any = null;
const loadXLSX = async () => {
  if (!XLSX) {
    XLSX = await import('xlsx');
  }
  return XLSX;
};

export default function FluktuasiOIPage() {
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string>('');
  const [fluktuasiData, setFluktuasiData] = useState<FluktuasiRow[]>([]);
  const [rekapData, setRekapData] = useState<RekapRow[]>([]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setFileName(file.name);

    try {
      const XLSXLib = await loadXLSX();
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSXLib.read(arrayBuffer);

      const sheetNames: string[] = workbook.SheetNames || [];
      if (sheetNames.length === 0) {
        alert('File tidak memiliki sheet.');
        return;
      }

      // Sheet angka = hanya nama numeric (contoh: 71510001, 71410001, dll)
      const detailSheetNames = sheetNames.filter((name) =>
        /^\d+$/.test(name.trim())
      );

      if (detailSheetNames.length === 0) {
        alert(
          'Tidak ada sheet angka yang ditemukan. Pastikan nama sheet adalah angka (misal: 71510001).',
        );
      }

      const allFluktuasiRows: FluktuasiRow[] = [];

      for (const sheetName of detailSheetNames) {
        const ws = workbook.Sheets[sheetName];
        if (!ws) continue;

        // Ambil sebagai array-of-arrays dulu supaya fleksibel
        const raw: any[][] = XLSXLib.utils.sheet_to_json(ws, {
          header: 1,
          defval: '',
        });

        if (raw.length < 2) continue; // minimal header + 1 data

        const headerRow = raw[0] as string[];

        // Asumsi: kolom dengan angka (nilai rupiah) berada setelah kolom deskripsi.
        // Kita cari dua kolom angka terakhir untuk hitung fluktuasi.
        const numericColumnIndexes: number[] = [];
        for (let col = 0; col < headerRow.length; col++) {
          // cek beberapa baris ke bawah untuk lihat apakah mayoritas numeric
          let numericCount = 0;
          let nonEmptyCount = 0;
          for (let r = 1; r < Math.min(raw.length, 10); r++) {
            const val = raw[r][col];
            if (val !== '' && val !== null && val !== undefined) {
              nonEmptyCount++;
              const num = Number(
                typeof val === 'string'
                  ? val.replace(/\./g, '').replace(/,/g, '.')
                  : val,
              );
              if (!Number.isNaN(num)) numericCount++;
            }
          }
          if (nonEmptyCount > 0 && numericCount / nonEmptyCount >= 0.7) {
            numericColumnIndexes.push(col);
          }
        }

        if (numericColumnIndexes.length < 2) {
          // Kalau kurang dari dua kolom angka, kita tetap simpan datanya tanpa fluktuasi
          for (let r = 1; r < raw.length; r++) {
            const row = raw[r];
            if (!row || row.every((cell: any) => cell === '' || cell === null)) {
              continue;
            }
            const obj: FluktuasiRow = {
              __sheetName: sheetName,
              __rowIndex: r,
            };
            headerRow.forEach((h, idx) => {
              if (!h) return;
              obj[h] = row[idx];
            });
            allFluktuasiRows.push(obj);
          }
          continue;
        }

        const lastIdx = numericColumnIndexes[numericColumnIndexes.length - 1];
        const prevIdx = numericColumnIndexes[numericColumnIndexes.length - 2];

        for (let r = 1; r < raw.length; r++) {
          const row = raw[r];
          if (!row || row.every((cell: any) => cell === '' || cell === null)) {
            continue;
          }

          const obj: FluktuasiRow = {
            __sheetName: sheetName,
            __rowIndex: r,
          };

          headerRow.forEach((h, idx) => {
            if (!h) return;
            obj[h] = row[idx];
          });

          const parseNumber = (val: any): number => {
            if (val === '' || val === null || val === undefined) return 0;
            if (typeof val === 'number') return val;
            const cleaned = val
              .toString()
              .replace(/\./g, '')
              .replace(/,/g, '.');
            const n = Number(cleaned);
            return Number.isNaN(n) ? 0 : n;
          };

          const current = parseNumber(row[lastIdx]);
          const previous = parseNumber(row[prevIdx]);
          const fluktuasi = current - previous;
          const persen =
            previous === 0 ? 0 : (fluktuasi / Math.abs(previous)) * 100;

          obj.fluktuasiRp = fluktuasi;
          obj.fluktuasiPersen = persen;

          // Reason sederhana di-generate dari nilai fluktuasi + nama sheet
          if (fluktuasi > 0) {
            obj.reason = `Kenaikan saldo pada sheet ${sheetName}`;
          } else if (fluktuasi < 0) {
            obj.reason = `Penurunan saldo pada sheet ${sheetName}`;
          } else {
            obj.reason = `Tidak ada perubahan signifikan pada sheet ${sheetName}`;
          }

          allFluktuasiRows.push(obj);
        }
      }

      setFluktuasiData(allFluktuasiRows);

      // Bangun data rekap per sheet
      const rekapPerSheet: Record<string, RekapRow> = {};
      allFluktuasiRows.forEach((row) => {
        const sheetName = row.__sheetName;
        if (!rekapPerSheet[sheetName]) {
          rekapPerSheet[sheetName] = {
            sheetName,
            totalFluktuasi: 0,
            avgFluktuasi: 0,
            maxFluktuasi: Number.NEGATIVE_INFINITY,
            minFluktuasi: Number.POSITIVE_INFINITY,
            reason: '',
          };
        }
        const r = rekapPerSheet[sheetName];
        const f = row.fluktuasiRp ?? 0;
        r.totalFluktuasi += f;
        if (f > r.maxFluktuasi) r.maxFluktuasi = f;
        if (f < r.minFluktuasi) r.minFluktuasi = f;

        // Ambil reason text dari baris-baris, gabung singkat
        if (row.reason) {
          if (!r.reason) {
            r.reason = String(row.reason);
          } else if (!r.reason.includes(row.reason)) {
            r.reason += `; ${row.reason}`;
          }
        }
      });

      // Hitung rata-rata
      Object.values(rekapPerSheet).forEach((r) => {
        const relatedRows = allFluktuasiRows.filter(
          (row) => row.__sheetName === r.sheetName,
        );
        const count = relatedRows.length || 1;
        r.avgFluktuasi = r.totalFluktuasi / count;
        if (r.maxFluktuasi === Number.NEGATIVE_INFINITY) r.maxFluktuasi = 0;
        if (r.minFluktuasi === Number.POSITIVE_INFINITY) r.minFluktuasi = 0;
      });

      setRekapData(Object.values(rekapPerSheet));
    } catch (error: any) {
      console.error('Error processing fluktuasi file:', error);
      alert(
        'Terjadi kesalahan saat membaca file Excel fluktuasi: ' +
          (error?.message || error),
      );
      setFileName('');
      setFluktuasiData([]);
      setRekapData([]);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadExcel = async () => {
    if (!fluktuasiData.length && !rekapData.length) {
      alert('Belum ada data untuk di-download. Upload file terlebih dahulu.');
      return;
    }

    const XLSXLib = await loadXLSX();
    const wb = XLSXLib.utils.book_new();

    if (fluktuasiData.length) {
      const detailSheet = XLSXLib.utils.json_to_sheet(
        fluktuasiData.map((row) => {
          const { __sheetName, __rowIndex, ...rest } = row;
          return {
            Sheet: __sheetName,
            Row: __rowIndex,
            ...rest,
          };
        }),
      );
      XLSXLib.utils.book_append_sheet(wb, detailSheet, 'Fluktuasi_Detail');
    }

    if (rekapData.length) {
      const rekapSheet = XLSXLib.utils.json_to_sheet(
        rekapData.map((r) => ({
          'Sheet / GL': r.sheetName,
          'Total Fluktuasi (Rp)': r.totalFluktuasi,
          'Rata-rata Fluktuasi (Rp)': r.avgFluktuasi,
          'Max Fluktuasi (Rp)': r.maxFluktuasi,
          'Min Fluktuasi (Rp)': r.minFluktuasi,
          Reason: r.reason,
        })),
      );
      XLSXLib.utils.book_append_sheet(wb, rekapSheet, 'Rekap_Fluktuasi');
    }

    const safeName =
      fileName?.replace(/\.[^.]+$/, '') || 'Fluktuasi_Other_Income_Expenses';
    XLSXLib.writeFile(wb, `${safeName}_HASIL_FLUKTUASI.xlsx`);
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Mobile Sidebar Overlay */}
      {isMobileSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setIsMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 transform transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <Sidebar onClose={() => setIsMobileSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 bg-gray-50 lg:ml-64 overflow-x-hidden">
        <Header
          title="Fluktuasi Other Income / Expenses"
          subtitle="Upload file Excel dan otomatis hitung fluktuasi serta rekap reason"
          onMenuClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
        />

        <div className="p-3 sm:p-4 md:p-6 lg:p-8 space-y-4 sm:space-y-6">
          {/* Upload Card */}
          <div className="bg-white rounded-lg p-5 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                  <FileSpreadsheet className="text-indigo-600" size={22} />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">
                    Upload File Fluktuasi
                  </h2>
                  <p className="text-xs sm:text-sm text-gray-600">
                    Gunakan file template yang memiliki sheet angka (71510001, 71410001, dll)
                    dan sheet Rekap seperti contoh.
                  </p>
                </div>
              </div>
              <button
                onClick={handleDownloadExcel}
                className="inline-flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg bg-indigo-600 text-xs sm:text-sm text-white hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isProcessing || (!fluktuasiData.length && !rekapData.length)}
              >
                <Download size={16} />
                <span>Download Excel Hasil</span>
              </button>
            </div>

            <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-500 hover:bg-indigo-50 transition-colors">
              <div className="flex flex-col items-center justify-center pt-5 pb-6">
                <Upload className="text-gray-400 mb-2" size={32} />
                <p className="mb-2 text-sm text-gray-500">
                  <span className="font-semibold">
                    {fileName ? fileName : 'Klik untuk upload'}
                  </span>{' '}
                  {!fileName && 'atau drag & drop'}
                </p>
                <p className="text-xs text-gray-500">
                  Excel file (.xlsx, .xls) – isi sampai kolom header biru, sistem
                  akan buat tabel merah & rekap otomatis
                </p>
              </div>
              <input
                type="file"
                className="hidden"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                disabled={isProcessing}
              />
            </label>

            {isProcessing && (
              <div className="flex items-center justify-center mt-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                <p className="ml-3 text-xs sm:text-sm text-gray-600">
                  Memproses file, mohon tunggu...
                </p>
              </div>
            )}
          </div>

          {/* Rekap Table */}
          {rekapData.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-red-50 to-yellow-50">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-red-700">
                  Rekap Fluktuasi Other Income / Expenses
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Merangkum total fluktuasi dan reason per sheet (mirip sheet Rekap di
                  Excel).
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-red-600 text-white">
                    <tr>
                      <th className="px-3 py-2 text-left">Sheet / GL</th>
                      <th className="px-3 py-2 text-right">Total Fluktuasi (Rp)</th>
                      <th className="px-3 py-2 text-right">
                        Rata-rata Fluktuasi (Rp)
                      </th>
                      <th className="px-3 py-2 text-right">Max</th>
                      <th className="px-3 py-2 text-right">Min</th>
                      <th className="px-3 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rekapData.map((row) => (
                      <tr key={row.sheetName} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-semibold text-gray-800">
                          {row.sheetName}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {row.totalFluktuasi.toLocaleString('id-ID', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {row.avgFluktuasi.toLocaleString('id-ID', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {row.maxFluktuasi.toLocaleString('id-ID', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-right text-gray-800">
                          {row.minFluktuasi.toLocaleString('id-ID', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-3 py-2 text-gray-700 max-w-xl">
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Detail Table */}
          {fluktuasiData.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-green-50">
                <h3 className="text-sm sm:text-base md:text-lg font-bold text-blue-700">
                  Detail Fluktuasi per Baris (Gabungan Semua Sheet Angka)
                </h3>
                <p className="text-xs text-gray-600 mt-1">
                  Representasi tabel dengan header biru + tambahan kolom merah (Fluktuasi
                  & Reason). Anda dapat filter kembali di Excel hasil download.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-[11px] sm:text-xs">
                  <thead className="bg-blue-600 text-white">
                    <tr>
                      <th className="px-2 py-2 text-left">Sheet</th>
                      <th className="px-2 py-2 text-right">Row</th>
                      <th className="px-2 py-2 text-right">Fluktuasi (Rp)</th>
                      <th className="px-2 py-2 text-right">Fluktuasi (%)</th>
                      <th className="px-2 py-2 text-left">Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {fluktuasiData.map((row, idx) => (
                      <tr
                        key={`${row.__sheetName}-${row.__rowIndex}-${idx}`}
                        className="border-b border-gray-100"
                      >
                        <td className="px-2 py-1 text-gray-800 font-medium">
                          {row.__sheetName}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-500">
                          {row.__rowIndex}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {(row.fluktuasiRp ?? 0).toLocaleString('id-ID', {
                            maximumFractionDigits: 0,
                          })}
                        </td>
                        <td className="px-2 py-1 text-right text-gray-800">
                          {((row.fluktuasiPersen ?? 0)).toLocaleString('id-ID', {
                            maximumFractionDigits: 2,
                          })}
                          %
                        </td>
                        <td className="px-2 py-1 text-gray-700 max-w-xl">
                          {row.reason}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

