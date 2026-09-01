import { NextRequest, NextResponse } from 'next/server';
import { gzipSync } from 'node:zlib';
import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { costStructureStorage } from '@/lib/cost-structure/storage/supabase-storage';

// Temporary preview-only extractor. Remove before opening the final PR.
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
    if (row.height !== undefined || row.hidden || row.outlineLevel) rows.push({ row: rowNumber, height: row.height, hidden: row.hidden || undefined, outlineLevel: row.outlineLevel || undefined });
  }
  const model = sheet.model as unknown as { merges?: string[]; properties?: unknown };
  return {
    name: sheet.name,
    state: sheet.state,
    rowCount: sheet.rowCount,
    columnCount: sheet.columnCount,
    views: normalize(sheet.views),
    pageSetup: normalize(sheet.pageSetup),
    headerFooter: normalize(sheet.headerFooter),
    properties: normalize(model.properties),
    merges: model.merges ?? [],
    autoFilter: normalize(sheet.autoFilter),
    columns,
    rows,
    styles,
    runs,
  };
}

export async function GET(request: NextRequest) {
  if (process.env.VERCEL_ENV === 'production') return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const target = request.nextUrl.searchParams.get('target');
  const package2000 = target === '199';
  const [targetPeriod, ...targetSheetParts] = package2000 ? ['1'] : target?.split(':') ?? [];
  const compressed = package2000 || targetSheetParts.at(-1)?.toLowerCase() === 'gzip';
  if (!package2000 && compressed) targetSheetParts.pop();
  const periodId = Number(target ? targetPeriod : request.nextUrl.searchParams.get('periodId'));
  const requestedSheet = package2000 ? null : target ? targetSheetParts.join(':') || null : request.nextUrl.searchParams.get('sheet');
  if (!Number.isInteger(periodId) || periodId <= 0) return NextResponse.json({ error: 'periodId is required' }, { status: 400 });

  const period = await prisma.costPeriod.findUnique({
    where: { id: periodId },
    include: {
      company: true,
      uploads: { where: { isActiveVersion: true }, orderBy: { version: 'desc' }, take: 1 },
    },
  });
  const upload = period?.uploads[0];
  if (!period || !upload) return NextResponse.json({ error: 'Active upload is required' }, { status: 409 });

  const bytes = await costStructureStorage.download(upload.storageKey);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes as never);

  if (package2000) {
    const targetNames = ['SI', 'rincian biaya', 'cc_adm', 'cc pasar'];
    const sheets = targetNames.map((name) => {
      const sheet = workbook.worksheets.find((item) => item.name.trim().toLocaleLowerCase() === name.toLocaleLowerCase());
      if (!sheet) throw new Error(`Sheet ${name} not found`);
      return extractSheet(sheet);
    });
    const payload = {
      companyCode: period.company.companyCode,
      sourceFileName: upload.originalFileName,
      uploadId: upload.id,
      uploadVersion: upload.version,
      sheets,
    };
    const data = gzipSync(Buffer.from(JSON.stringify(payload), 'utf8'), { level: 9 }).toString('base64');
    return NextResponse.json({ companyCode: period.company.companyCode, sourceFileName: upload.originalFileName, uploadId: upload.id, uploadVersion: upload.version, encoding: 'gzip-base64', data });
  }

  if (!requestedSheet) return NextResponse.json({ companyCode: period.company.companyCode, sourceFileName: upload.originalFileName, uploadId: upload.id, uploadVersion: upload.version, sheets: workbook.worksheets.map((sheet) => ({ name: sheet.name, rowCount: sheet.rowCount, columnCount: sheet.columnCount, state: sheet.state })) });
  const sheet = workbook.worksheets.find((item) => item.name.trim().toLocaleLowerCase() === requestedSheet.trim().toLocaleLowerCase());
  if (!sheet) return NextResponse.json({ error: `Sheet ${requestedSheet} not found` }, { status: 404 });
  const extracted = extractSheet(sheet);
  if (compressed) {
    const data = gzipSync(Buffer.from(JSON.stringify(extracted), 'utf8'), { level: 9 }).toString('base64');
    return NextResponse.json({ companyCode: period.company.companyCode, sourceFileName: upload.originalFileName, uploadId: upload.id, uploadVersion: upload.version, sheetName: sheet.name, encoding: 'gzip-base64', data });
  }
  return NextResponse.json({ companyCode: period.company.companyCode, sourceFileName: upload.originalFileName, uploadId: upload.id, uploadVersion: upload.version, sheet: extracted });
}
