import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { applySheetStyleBlueprint, applyWorkbookStyleBlueprint } from './apply';
import { ACCOUNTING_FORMAT } from './common';
import { getWorkbookStyleBlueprint } from './registry';
import type { SheetStyleBlueprint } from './types';

const fullBlueprint: SheetStyleBlueprint = {
  aliases: ['detail_alias'],
  styleCatalog: {
    header: {
      font: { name: 'Arial', size: 12, bold: true, italic: true, underline: true, color: { argb: 'FF102030' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFABCDEF' }, bgColor: { argb: 'FF010203' } },
      border: {
        top: { style: 'thin', color: { argb: 'FF111111' } }, bottom: { style: 'medium', color: { argb: 'FF222222' } },
        left: { style: 'dashed', color: { argb: 'FF333333' } }, right: { style: 'double', color: { argb: 'FF444444' } },
      },
      numFmt: '#,##0.00', protection: { locked: true, hidden: true },
    },
    detailAmount: { numFmt: '#,##0.00', alignment: { horizontal: 'right' } },
    subtotal: { font: { bold: true }, fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } } },
    total: { font: { bold: true, underline: true }, border: { top: { style: 'double' } } },
  },
  columns: [{ key: 'A', width: 22 }, { key: 'D', hidden: true, outlineLevel: 1 }],
  rows: [{ index: 1, height: 31 }, { index: 9, hidden: true, outlineLevel: 2 }],
  merges: ['A10:B10'],
  views: [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }],
  autoFilter: 'A1:C9',
  pageSetup: { orientation: 'landscape', printArea: 'A1:D10' },
  headerFooter: { oddHeader: '&CBlueprint' },
  repeatingRanges: [{ fromColumn: 'B', toColumn: 'B', fromRow: 2, styleRole: 'detailAmount' }],
  ranges: [{ range: 'A1:D1', styleRole: 'header' }, { range: 'A8:D8', styleRole: 'subtotal' }, { range: 'A9:D9', styleRole: 'total' }],
};

async function roundTrip(workbook: ExcelJS.Workbook) {
  const serialized = await workbook.xlsx.writeBuffer();
  return new ExcelJS.Workbook().xlsx.load(serialized);
}

test('round-trip applies supported static cell and worksheet style features', async () => {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Detail');
  sheet.addRows([['Heading'], ['one', 1], ['two', -2], ['three', 0], [], [], [], ['subtotal', 4], ['total', 4]]);
  applySheetStyleBlueprint(sheet, fullBlueprint);
  const loaded = await roundTrip(workbook);
  const styled = loaded.getWorksheet('Detail')!;
  const header = styled.getCell('A1');
  assert.equal(header.font?.name, 'Arial'); assert.equal(header.font?.size, 12); assert.equal(header.font?.bold, true);
  assert.equal(header.font?.italic, true); assert.equal(header.font?.underline, true); assert.equal(header.font?.color?.argb, 'FF102030');
  assert.equal(header.alignment?.horizontal, 'center'); assert.equal(header.alignment?.vertical, 'middle'); assert.equal(header.alignment?.wrapText, true);
  assert.equal(header.fill.type, 'pattern'); if (header.fill.type === 'pattern') assert.equal(header.fill.fgColor?.argb, 'FFABCDEF');
  assert.equal(header.border.top?.style, 'thin'); assert.equal(header.border.bottom?.style, 'medium'); assert.equal(header.border.left?.style, 'dashed'); assert.equal(header.border.right?.style, 'double');
  assert.equal(header.numFmt, '#,##0.00'); assert.equal(header.protection?.locked, true); assert.equal(header.protection?.hidden, true);
  assert.equal(styled.getRow(1).height, 31); assert.equal(styled.getColumn('A').width, 22); assert.equal(styled.getColumn('D').hidden, true); assert.equal(styled.getColumn('D').outlineLevel, 1);
  assert.equal(styled.getRow(9).hidden, true); assert.equal(styled.getRow(9).outlineLevel, 2); assert.equal(styled.getCell('A10').isMerged, true);
  assert.equal(styled.views[0].state, 'frozen'); assert.equal(styled.views[0].xSplit, 1); assert.equal(styled.views[0].ySplit, 1);
  assert.equal(styled.autoFilter, 'A1:C9'); assert.equal(styled.pageSetup.orientation, 'landscape'); assert.equal(styled.pageSetup.printArea, 'A1:D10');
  assert.equal(styled.headerFooter.oddHeader, '&CBlueprint');
});

test('styling never changes values or formulas', async () => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Detail');
  sheet.addRows([['header'], ['large', 9_007_199_254_740_990], ['negative', -9_876_543_210.25], ['zero', 0]]);
  sheet.getCell('B5').value = { formula: 'SUM(B2:B4)', result: 8_997_322_711_530_780 };
  const addresses = ['B2','B3','B4','B5'];
  const before = addresses.map((address) => structuredClone(sheet.getCell(address).value));
  applySheetStyleBlueprint(sheet, fullBlueprint);
  assert.deepEqual(addresses.map((address) => sheet.getCell(address).value), before);
  const loaded = await roundTrip(workbook); const styled = loaded.getWorksheet('Detail')!;
  assert.deepEqual(addresses.map((address) => styled.getCell(address).value), before);
});

test('Company 7000 compatibility blueprint reproduces the pre-framework GHoPO/DERIV layout', () => {
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('GHoPO');
  sheet.getCell('A55').value = 'template extent';
  applyWorkbookStyleBlueprint(workbook, getWorkbookStyleBlueprint('7000'));
  assert.equal(sheet.views[0].state, 'frozen'); assert.equal(sheet.views[0].ySplit, 1); assert.equal(sheet.pageSetup.printArea, 'A1:B47');
  assert.equal(sheet.getColumn('A').width, 53.78); assert.equal(sheet.getColumn('K').width, 18.78); assert.equal(sheet.getColumn('C').hidden, true); assert.equal(sheet.getRow(20).hidden, true);
  assert.equal(sheet.getCell('A2').font.name, 'Arial'); assert.equal(sheet.getCell('A2').font.bold, true); assert.equal(sheet.getCell('A2').font.color?.argb, 'FFC00000');
  assert.equal(sheet.getCell('A19').font.bold, true); assert.equal(sheet.getCell('A19').fill.type, 'pattern');
  assert.equal(sheet.getCell('B19').font.bold, true); assert.equal(sheet.getCell('B19').numFmt, ACCOUNTING_FORMAT);
  assert.equal(sheet.getCell('A45').font.bold, false); assert.equal(sheet.getCell('A45').fill.type, 'pattern'); assert.equal(sheet.getCell('B45').font.bold, true);
  assert.equal(sheet.getCell('B55').numFmt, ACCOUNTING_FORMAT);
});

test('Company 2000 exact blueprint is frozen from authoritative Jul-2026 active upload v2', () => {
  const blueprint = getWorkbookStyleBlueprint('2000');
  assert.equal(blueprint.exactTemplateFidelity, true);
  assert.equal(blueprint.sourceTemplatePeriod, '2026-07');
  assert.match(blueprint.templateVersion, /active-upload-v2-exact-style/);
  assert.deepEqual(Object.keys(blueprint.sheets), ['SI', 'rincian biaya', 'cc ADM', 'cc pasar']);

  const si = blueprint.sheets.SI;
  assert.equal(si.sourceTemplateName, 'SI');
  assert.ok((si.ranges?.length ?? 0) > 0);
  assert.ok((si.columns?.length ?? 0) > 0);

  const rincian = blueprint.sheets['rincian biaya'];
  assert.equal(rincian.sourceTemplateName, 'rincian biaya');
  assert.ok((rincian.ranges?.length ?? 0) > 0);

  const ccAdm = blueprint.sheets['cc ADM'];
  assert.equal(ccAdm.sourceTemplateName, 'cc_adm');
  assert.deepEqual(ccAdm.aliases, ['cc_adm', 'cc adm']);

  const ccPasar = blueprint.sheets['cc pasar'];
  assert.equal(ccPasar.sourceTemplateName, 'cc pasar');
  assert.deepEqual(ccPasar.aliases, ['cc_pasar']);
});

test('Company 2000 exact blueprint applies without changing DB-authored values', () => {
  const workbook = new ExcelJS.Workbook();
  const si = workbook.addWorksheet('SI');
  const rincian = workbook.addWorksheet('rincian biaya');
  const ccAdm = workbook.addWorksheet('cc ADM');
  const ccPasar = workbook.addWorksheet('cc pasar');
  si.getCell('B3').value = 123456789;
  rincian.getCell('D4').value = -987654321;
  ccAdm.getCell('A1').value = 'DB VALUE';
  ccPasar.getCell('A1').value = 'DB VALUE';
  const before = [si.getCell('B3').value, rincian.getCell('D4').value, ccAdm.getCell('A1').value, ccPasar.getCell('A1').value];
  applyWorkbookStyleBlueprint(workbook, getWorkbookStyleBlueprint('2000'));
  assert.deepEqual([si.getCell('B3').value, rincian.getCell('D4').value, ccAdm.getCell('A1').value, ccPasar.getCell('A1').value], before);
});

test('Formula Audit remains untouched by Company 7000 style blueprint', () => {
  const workbook = new ExcelJS.Workbook();
  const audit = workbook.addWorksheet('Formula Audit'); audit.getCell('A1').value = 'system'; audit.getCell('A1').font = { bold: true };
  const auditStyle = structuredClone(audit.getCell('A1').style);
  applyWorkbookStyleBlueprint(workbook, getWorkbookStyleBlueprint('7000'));
  assert.deepEqual(audit.getCell('A1').style, auditStyle);
});

test('registry scope is locked and missing style roles fail closed', () => {
  const company2000 = getWorkbookStyleBlueprint('2000'); const company7000 = getWorkbookStyleBlueprint('7000');
  assert.deepEqual(Object.keys(company2000.sheets), ['SI', 'rincian biaya', 'cc ADM', 'cc pasar']);
  assert.deepEqual(Object.keys(company7000.sheets), ['GHoPO', 'DERIV', 'rincian biaya', 'cc_prod', 'cc_adm', 'cc pasar']);
  assert.equal(company2000.exactTemplateFidelity, true);
  const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Bad');
  assert.throws(() => applySheetStyleBlueprint(sheet, { styleCatalog: {}, ranges: [{ range: 'A1', styleRole: 'missing' }] }), /Unknown workbook style role/);
});
