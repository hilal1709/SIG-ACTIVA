import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import { parseAmount } from './amount';
import { detectSource, normalizeLabel, sourceDefinitions } from './source-registry';
import type { LogicalSourceCode, ParsedWorkbook, ParsedSourceRow } from './types';

// Prefer the authoritative raw SAP columns before helper/formula columns when both are present.
const COA = ['ACCOUNT', 'ACCOUNT CODE', 'G/L ACCOUNT', 'GL ACCOUNT', 'COST ELEMENTS', 'COST ELEMENT', 'COA', 'KODE AKUN', 'AKUN', 'KODE', 'CE'];
const DESC = ['ACCOUNT DESCRIPTION', 'DESCRIPTION', 'G/L ACCOUNT LONG TEXT', 'GL DESCRIPTION', 'NAMA AKUN', 'DESKRIPSI', 'DESCR'];
const AMOUNT = ['AMOUNT', 'ACTUAL', 'ACTUAL AMOUNT', 'ACT COSTS', 'VALUE', 'NILAI', 'BALANCE', 'SALDO', 'ACT AMT'];
const COA_REQUIRED = new Set<LogicalSourceCode>(['TB', 'CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG']);
const RAW_FALLBACK = new Set<LogicalSourceCode>(['COAL', 'CLINKER_PURCHASE', 'SOLAR_PP_ORDER', 'OA_STAT']);

const text = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'object' && value && 'result' in value) return text((value as { result: unknown }).result);
  return String(value).trim() || null;
};

const indexOf = (row: string[], aliases: string[]) => row.findIndex((value) => aliases.includes(normalizeLabel(value)));

function extractCoa(value: unknown, header: string): string | null {
  const raw = text(value);
  if (!raw) return null;
  if (header === 'COST ELEMENTS' || header === 'COST ELEMENT') {
    // SAP Cost Elements cells are authoritative and begin with the 8-digit account followed by text.
    const match = raw.match(/^\s*(\d{8})(?:\s|$)/);
    return match?.[1] ?? null;
  }
  return raw;
}

function descriptionFromCostElement(value: unknown): string | null {
  const raw = text(value);
  if (!raw) return null;
  return raw.replace(/^\s*\d{8}\s*/, '').trim() || raw;
}

async function loadWorkbook(bytes: Uint8Array): Promise<ExcelJS.Workbook> {
  const buffer = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);
    return workbook;
  } catch (primaryError) {
    // Some SAP-generated XLSX packages contain optional OOXML parts that Excel/SheetJS tolerate
    // but ExcelJS rejects. Re-serializing with the already-installed SheetJS library strips only
    // unsupported package metadata; source cell values/formulas remain input data, not calculations.
    try {
      const source = XLSX.read(buffer, { type: 'buffer', cellFormula: true, cellDates: false });
      const normalized = XLSX.write(source, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
      const fallback = new ExcelJS.Workbook();
      await fallback.xlsx.load(normalized as unknown as Parameters<typeof fallback.xlsx.load>[0]);
      return fallback;
    } catch {
      throw primaryError;
    }
  }
}

function preserveRawRows(sheet: ExcelJS.Worksheet, code: LogicalSourceCode): ParsedSourceRow[] {
  const rows: ParsedSourceRow[] = [];
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const values = (sheet.getRow(rowNumber).values as unknown[]).slice(1);
    if (values.every((value) => text(value) === null)) continue;
    const rawDataJson = Object.fromEntries(values.map((value, index) => [`COLUMN_${index + 1}`, text(value)]));
    rows.push({
      logicalSourceCode: code,
      originalSheetName: sheet.name,
      sourceRowNumber: rowNumber,
      coaCodeRaw: null,
      descriptionRaw: null,
      amountRaw: null,
      amount: null,
      sourceGroupRaw: null,
      rawDataJson,
    });
  }
  return rows;
}

export async function parseWorkbook(bytes: Uint8Array, companyCode: string): Promise<ParsedWorkbook> {
  const workbook = await loadWorkbook(bytes);
  const rows: ParsedSourceRow[] = [];
  const issues: ParsedWorkbook['issues'] = [];
  const sources: ParsedWorkbook['sources'] = [];
  const matched = new Map<string, ExcelJS.Worksheet[]>();

  workbook.eachSheet((sheet) => {
    if (normalizeLabel(sheet.name) === 'META') return;
    const definition = detectSource(sheet.name, companyCode);
    if (definition) matched.set(definition.code, [...(matched.get(definition.code) || []), sheet]);
  });

  for (const definition of sourceDefinitions(companyCode)) {
    const sheets = matched.get(definition.code) || [];
    if (!sheets.length && definition.required) {
      issues.push({ issueCode: 'REQUIRED_SOURCE_MISSING', severity: 'ERROR', message: `Sumber wajib ${definition.code} tidak ditemukan.` });
    }
    if (sheets.length > 1) {
      issues.push({ issueCode: 'SOURCE_AMBIGUOUS', severity: 'ERROR', message: `Lebih dari satu worksheet cocok dengan ${definition.code}: ${sheets.map((sheet) => sheet.name).join(', ')}.` });
    }
    if (sheets.length !== 1) continue;

    const sheet = sheets[0];

    // Verified July-2026 Company 2000 workbook contains a structurally present but empty cc_prod sheet.
    // Company 2000 Cost Structure is ADUM/PASAR only, so presence of this empty structural source is valid.
    if (companyCode === '2000' && definition.code === 'CC_PROD' && sheet.actualRowCount === 0) {
      issues.push({ issueCode: 'SOURCE_EMPTY', severity: 'INFO', message: `Sumber ${definition.code} terdeteksi sebagai worksheet kosong dan tidak berkontribusi pada Company 2000.` });
      sources.push({ code: definition.code, sheetName: sheet.name, rowCount: 0 });
      continue;
    }

    let headerRow = 0;
    let coa = -1;
    let desc = -1;
    let amount = -1;

    for (let rowNumber = 1; rowNumber <= Math.min(sheet.rowCount, 30); rowNumber += 1) {
      const values = (sheet.getRow(rowNumber).values as unknown[]).slice(1).map((value) => text(value) || '');
      const coaIndex = indexOf(values, COA);
      const descIndex = indexOf(values, DESC);
      const amountIndex = indexOf(values, AMOUNT);
      if (amountIndex >= 0 && (coaIndex >= 0 || descIndex >= 0)) {
        headerRow = rowNumber;
        coa = coaIndex;
        desc = descIndex;
        amount = amountIndex;
        break;
      }
    }

    if (!headerRow) {
      if (RAW_FALLBACK.has(definition.code)) {
        const fallbackRows = preserveRawRows(sheet, definition.code);
        rows.push(...fallbackRows);
        issues.push({
          issueCode: 'SOURCE_HEADER_NOT_FOUND',
          severity: 'WARNING',
          message: `Header generik belum dikenali pada ${sheet.name}; raw lineage dipertahankan untuk parser golden-source berikutnya.`,
        });
        sources.push({ code: definition.code, sheetName: sheet.name, rowCount: fallbackRows.length });
      } else {
        issues.push({
          issueCode: 'SOURCE_HEADER_NOT_FOUND',
          severity: definition.required ? 'ERROR' : 'WARNING',
          message: `Header tabular yang aman tidak ditemukan pada ${sheet.name}.`,
        });
        sources.push({ code: definition.code, sheetName: sheet.name, rowCount: 0 });
      }
      continue;
    }

    const headers = (sheet.getRow(headerRow).values as unknown[]).slice(1).map((value, index) => text(value) || `COLUMN_${index + 1}`);
    const coaHeader = coa >= 0 ? normalizeLabel(headers[coa]) : '';
    let count = 0;
    for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = (sheet.getRow(rowNumber).values as unknown[]).slice(1);
      if (values.every((value) => text(value) === null)) continue;
      const coaRaw = coa >= 0 ? extractCoa(values[coa], coaHeader) : null;
      const descriptionRaw = desc >= 0
        ? text(values[desc])
        : (coaHeader === 'COST ELEMENTS' || coaHeader === 'COST ELEMENT')
          ? descriptionFromCostElement(values[coa])
          : null;
      const amountRaw = text(values[amount]);
      const parsedAmount = parseAmount(
        typeof values[amount] === 'object' && values[amount] && 'result' in (values[amount] as object)
          ? (values[amount] as { result: unknown }).result
          : values[amount],
      );

      // SAP exports may carry formula tails where only amount=0 remains below the actual report.
      // With neither a source COA nor description these are layout artifacts, not accounting rows.
      if (COA_REQUIRED.has(definition.code) && !coaRaw && !descriptionRaw && parsedAmount === '0') continue;

      const rawDataJson = Object.fromEntries(headers.map((header, index) => [header, text(values[index])]));
      rows.push({
        logicalSourceCode: definition.code,
        originalSheetName: sheet.name,
        sourceRowNumber: rowNumber,
        coaCodeRaw: coaRaw,
        descriptionRaw,
        amountRaw,
        amount: parsedAmount,
        sourceGroupRaw: null,
        rawDataJson,
      });
      count += 1;

      if (COA_REQUIRED.has(definition.code) && !coaRaw) {
        issues.push({ issueCode: 'SOURCE_ROW_MISSING_COA', severity: 'ERROR', message: `COA kosong pada ${sheet.name} baris ${rowNumber}.`, rowIndex: rows.length - 1 });
      }
      if (amountRaw !== null && parsedAmount === null) {
        issues.push({ issueCode: 'SOURCE_ROW_INVALID_AMOUNT', severity: 'ERROR', message: `Amount tidak valid pada ${sheet.name} baris ${rowNumber}.`, rowIndex: rows.length - 1 });
      }
    }
    sources.push({ code: definition.code, sheetName: sheet.name, rowCount: count });
  }

  return { rows, issues, sources };
}
