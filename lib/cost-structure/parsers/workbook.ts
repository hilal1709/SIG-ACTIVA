import ExcelJS from 'exceljs';
import { parseAmount } from './amount';
import { detectSource, normalizeLabel, sourceDefinitions } from './source-registry';
import type { LogicalSourceCode, ParsedWorkbook, ParsedSourceRow } from './types';

const COA = ['ACCOUNT', 'ACCOUNT CODE', 'G/L ACCOUNT', 'GL ACCOUNT', 'COST ELEMENT', 'COA', 'KODE AKUN', 'AKUN'];
const DESC = ['ACCOUNT DESCRIPTION', 'DESCRIPTION', 'G/L ACCOUNT LONG TEXT', 'GL DESCRIPTION', 'NAMA AKUN', 'DESKRIPSI'];
const AMOUNT = ['AMOUNT', 'ACTUAL', 'ACTUAL AMOUNT', 'VALUE', 'NILAI', 'BALANCE', 'SALDO'];
const COA_REQUIRED = new Set<LogicalSourceCode>(['TB', 'CC_PROD', 'CC_ADUM', 'CC_PASAR', 'CC_WHRPG']);
const RAW_FALLBACK = new Set<LogicalSourceCode>(['COAL', 'CLINKER_PURCHASE', 'SOLAR_PP_ORDER', 'OA_STAT']);

const text = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'object' && value && 'result' in value) return text((value as { result: unknown }).result);
  return String(value).trim() || null;
};

const indexOf = (row: string[], aliases: string[]) => row.findIndex((value) => aliases.includes(normalizeLabel(value)));

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
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);
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
    let count = 0;
    for (let rowNumber = headerRow + 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
      const values = (sheet.getRow(rowNumber).values as unknown[]).slice(1);
      if (values.every((value) => text(value) === null)) continue;
      const rawDataJson = Object.fromEntries(headers.map((header, index) => [header, text(values[index])]));
      const coaRaw = coa >= 0 ? text(values[coa]) : null;
      const amountRaw = text(values[amount]);
      const parsedAmount = parseAmount(
        typeof values[amount] === 'object' && values[amount] && 'result' in (values[amount] as object)
          ? (values[amount] as { result: unknown }).result
          : values[amount],
      );

      rows.push({
        logicalSourceCode: definition.code,
        originalSheetName: sheet.name,
        sourceRowNumber: rowNumber,
        coaCodeRaw: coaRaw,
        descriptionRaw: desc >= 0 ? text(values[desc]) : null,
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
