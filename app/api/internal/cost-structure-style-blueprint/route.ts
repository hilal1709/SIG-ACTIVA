import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

function normalize(value: unknown): unknown {
  if (value === undefined) return undefined;
  if (value === null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(normalize);
  if (typeof value === 'object') {
    const output: JsonRecord = {};
    for (const [key, item] of Object.entries(value as JsonRecord)) {
      const normalized = normalize(item);
      if (normalized !== undefined) output[key] = normalized;
    }
    return output;
  }
  return String(value);
}

function columnLetter(column: number) {
  let value = column;
  let result = '';
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function extractSheet(sheet: ExcelJS.Worksheet) {
  const styles: unknown[] = [];
  const styleIds = new Map<string, number>();
  const runs: Array<{ range: string; style: number }> = [];
  const styleId = (style: unknown) => {
    const normalized = normalize(style) ?? {};
    const key = JSON.stringify(normalized);
    const existing = styleIds.get(key);
    if (existing !== undefined) return existing;
    const id = styles.length;
    styles.push(normalized);
    styleIds.set(key, id);
    return id;
  };
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    let start: number | null = null;
    let currentStyle: number | null = null;
    const flush = (endColumn: number) => {
      if (start === null || currentStyle === null) return;
      const left = `${columnLetter(start)}${rowNumber}`;
      const right = `${columnLetter(endColumn)}${rowNumber}`;
      runs.push({ range: left === right ? left : `${left}:${right}`, style: currentStyle });
      start = null;
      currentStyle = null;
    };
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      const cell = sheet.getCell(rowNumber, column);
      if (!Object.keys(cell.style ?? {}).length) { flush(column - 1); continue; }
      const id = styleId(cell.style);
      if (currentStyle === id) continue;
      flush(column - 1);
      start = column;
      currentStyle = id;
    }
    flush(sheet.columnCount);
  }
  const columns = [];
  for (let column = 1; column <= sheet.columnCount; column += 1) {
    const item = sheet.getColumn(column);
    if (item.width !== undefined || item.hidden || item.outlineLevel || Object.keys(item.style ?? {}).length) {
      columns.push({ column, width: item.width, hidden: item.hidden || undefined, outlineLevel: item.outlineLevel || undefined, style: Object.keys(item.style ?? {}).length ? normalize(item.style) : undefined });
    }
  }
  const rows = [];
  for (let rowNumber = 1; rowNumber <= sheet.rowCount; rowNumber += 1) {
    const row = sheet.getRow(rowNumber);
    if (row.height !== undefined || row.hidden || row.outlineLevel || Object.keys(row.style ?? {}).length) {
      rows.push({ row: rowNumber, height: row.height, hidden: row.hidden || undefined, outlineLevel: row.outlineLevel || undefined, style: Object.keys(row.style ?? {}).length ? normalize(row.style) : undefined });
    }
  }
  const model = sheet.model as unknown as { merges?: string[] };
  return { name: sheet.name, state: sheet.state, rowCount: sheet.rowCount, columnCount: sheet.columnCount, views: normalize(sheet.views), pageSetup: normalize(sheet.pageSetup), pageMargins: normalize(sheet.pageMargins), headerFooter: normalize(sheet.headerFooter), properties: normalize(sheet.properties), merges: model.merges ?? [], columns, rows, styles, runs };
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const periodId = Number(request.nextUrl.searchParams.get('periodId'));
  if (!Number.isInteger(periodId) || periodId <= 0) return NextResponse.json({ error: 'periodId is required' }, { status: 400 });
  const period = await prisma.costPeriod.findUnique({ where: { id: periodId }, include: { company: true, activeCalculationRun: { include: { upload: true } } } });
  const run = period?.activeCalculationRun;
  if (!period || !run || run.status !== 'SUCCESS' || !run.isActive) return NextResponse.json({ error: 'Active SUCCESS run is required' }, { status: 409 });
  const bytes = await costStructureStorage.download(run.upload.storageKey);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(Buffer.from(bytes));
  const requestedSheet = request.nextUrl.searchParams.get('sheet');
  if (!requestedSheet) return NextResponse.json({ companyCode: period.company.companyCode, sourceFileName: run.upload.originalFileName, sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.rowCount, columnCount: sheet.columnCount, state: sheet.state })) });
  const sheet = workbook.worksheets.find((item) => item.name.trim().toLocaleLowerCase() === requestedSheet.trim().toLocaleLowerCase());
  if (!sheet) return NextResponse.json({ error: `Sheet ${requestedSheet} not found` }, { status: 404 });
  return NextResponse.json({ companyCode: period.company.companyCode, sheet: extractSheet(sheet) });
}
