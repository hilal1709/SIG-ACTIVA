import type ExcelJS from 'exceljs';
import type { BlueprintCellStyle, SheetStyleBlueprint, StyleRole, WorkbookStyleBlueprint } from './types';

function copyStyle(style: BlueprintCellStyle): BlueprintCellStyle {
  return structuredClone(style);
}

function resolveStyle(blueprint: SheetStyleBlueprint, role: StyleRole): BlueprintCellStyle {
  const style = blueprint.styleCatalog[role];
  if (!style) throw new Error(`Unknown workbook style role: ${role}`);
  return style;
}

function applyRange(sheet: ExcelJS.Worksheet, range: string, style: BlueprintCellStyle) {
  const [start, end = start] = range.split(':');
  const startCell = sheet.getCell(start);
  const endCell = sheet.getCell(end);
  for (let row = startCell.row; row <= endCell.row; row += 1) {
    for (let column = startCell.col; column <= endCell.col; column += 1) {
      Object.assign(sheet.getCell(row, column), copyStyle(style));
    }
  }
}

export function applySheetStyleBlueprint(sheet: ExcelJS.Worksheet, blueprint: SheetStyleBlueprint) {
  if (blueprint.views) sheet.views = structuredClone(blueprint.views) as ExcelJS.WorksheetView[];
  if (blueprint.pageSetup) Object.assign(sheet.pageSetup, structuredClone(blueprint.pageSetup));
  if (blueprint.headerFooter) Object.assign(sheet.headerFooter, structuredClone(blueprint.headerFooter));
  if (blueprint.autoFilter && sheet.rowCount >= (blueprint.autoFilterMinRowCount ?? 0)) {
    sheet.autoFilter = structuredClone(blueprint.autoFilter);
  }
  if (blueprint.state) sheet.state = blueprint.state;

  for (const column of blueprint.columns ?? []) {
    const target = sheet.getColumn(column.key);
    if (column.width !== undefined) target.width = column.width;
    if (column.hidden !== undefined) target.hidden = column.hidden;
    if (column.outlineLevel !== undefined) target.outlineLevel = column.outlineLevel;
    if (column.styleRole) Object.assign(target, { style: copyStyle(resolveStyle(blueprint, column.styleRole)) });
  }
  for (const row of blueprint.rows ?? []) {
    const target = sheet.getRow(row.index);
    if (row.height !== undefined) target.height = row.height;
    if (row.hidden !== undefined) target.hidden = row.hidden;
    if (row.outlineLevel !== undefined) target.outlineLevel = row.outlineLevel;
    if (row.styleRole) {
      const rowStyle = resolveStyle(blueprint, row.styleRole);
      target.eachCell({ includeEmpty: true }, (cell) => Object.assign(cell, copyStyle(rowStyle)));
    }
  }
  for (const merge of blueprint.merges ?? []) {
    if (!sheet.getCell(merge.split(':')[0]).isMerged) sheet.mergeCells(merge);
  }
  for (const repeating of blueprint.repeatingRanges ?? []) {
    const dynamicEnd = repeating.toRow ?? sheet.rowCount;
    const endRow = Math.max(repeating.fromRow, repeating.minimumToRow ?? repeating.fromRow, dynamicEnd);
    applyRange(
      sheet,
      `${repeating.fromColumn}${repeating.fromRow}:${repeating.toColumn}${endRow}`,
      resolveStyle(blueprint, repeating.styleRole),
    );
  }
  // Fixed template overrides deliberately win over repeating/base formatting.
  for (const range of blueprint.ranges ?? []) {
    applyRange(sheet, range.range, resolveStyle(blueprint, range.styleRole));
  }
  return sheet;
}

export function applyWorkbookStyleBlueprint(workbook: ExcelJS.Workbook, blueprint: WorkbookStyleBlueprint) {
  for (const [canonicalName, sheetBlueprint] of Object.entries(blueprint.sheets)) {
    const names = [canonicalName, sheetBlueprint.sourceTemplateName, ...(sheetBlueprint.aliases ?? [])].filter(Boolean) as string[];
    const normalized = new Set(names.map((name) => name.trim().toLowerCase().replace(/[ _-]+/g, '')));
    const sheet = workbook.worksheets.find((candidate) => normalized.has(candidate.name.trim().toLowerCase().replace(/[ _-]+/g, '')));
    if (sheet) applySheetStyleBlueprint(sheet, sheetBlueprint);
  }
  return workbook;
}
