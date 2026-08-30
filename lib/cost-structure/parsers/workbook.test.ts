import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { parseWorkbook } from './workbook';

describe('parseWorkbook raw support-source lineage', () => {
  it('preserves unmatched special-source rows without inventing COA or amount semantics', async () => {
    const workbook = new ExcelJS.Workbook();
    const coal = workbook.addWorksheet('COAL');
    coal.addRow(['Material', 'Quantity', 'Price']);
    coal.addRow(['COAL-A', 2, 100]);

    const bytes = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(bytes as unknown as Uint8Array, '7000');
    const coalRows = parsed.rows.filter((row) => row.logicalSourceCode === 'COAL');

    assert.equal(coalRows.length, 2);
    assert.equal(coalRows[1].rawDataJson.COLUMN_1, 'COAL-A');
    assert.equal(coalRows[1].coaCodeRaw, null);
    assert.equal(coalRows[1].amount, null);
    assert.equal(parsed.sources.find((source) => source.code === 'COAL')?.rowCount, 2);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_ROW_MISSING_COA' && issue.message.includes('COAL')), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_HEADER_NOT_FOUND' && issue.severity === 'WARNING' && issue.message.includes('COAL')), true);
  });

  it('ignores META as an authoritative logical source', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('META').addRow(['Company', '7000']);
    const tb = workbook.addWorksheet('TB');
    tb.addRow(['Account', 'Description', 'Amount']);
    tb.addRow(['001000', 'Test', 10]);

    const bytes = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(bytes as unknown as Uint8Array, '2000');

    assert.equal(parsed.sources.some((source) => source.sheetName === 'META'), false);
    assert.equal(parsed.rows.find((row) => row.logicalSourceCode === 'TB')?.coaCodeRaw, '001000');
  });

  it('prefers authoritative Cost Elements / Act. Costs over SAP helper columns', async () => {
    const workbook = new ExcelJS.Workbook();
    const tb = workbook.addWorksheet('tb');
    tb.addRow(['', '', '', '', '', '', '', 'kode ', 'descr', 'amount']);
    tb.addRow(['', '', '', '', '', '', '', '61110002', 'Limestone', 5]);

    workbook.addWorksheet('cc_prod');

    for (const name of ['cc_adm', 'cc pasar']) {
      const sheet = workbook.addWorksheet(name);
      for (let i = 1; i < 13; i += 1) sheet.addRow([]);
      sheet.addRow(['', '', 'Cost Elements', 'Act. Costs', '', '', '', '', '', '', '', '', 'CE', 'Act Amt', 'Group CE']);
      sheet.addRow(['', '', '   61110002  LIMEST. CONSUMPT.', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C14,8)' }, { formula: 'D14' }, '6']);
      sheet.addRow(['', '', '*  Debit', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C15,8)' }, { formula: 'D15' }, 'D']);
      sheet.addRow(['', '', '** Over/Underabsorption', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C16,8)' }, { formula: 'D16' }, 'O']);
      sheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', { formula: '0' }, '']);
    }

    const bytes = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(new Uint8Array(bytes as ArrayBuffer), '2000');

    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'REQUIRED_SOURCE_MISSING'), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_HEADER_NOT_FOUND' && issue.severity === 'ERROR'), false);
    assert.equal(parsed.sources.find((source) => source.code === 'CC_ADUM')?.sheetName, 'cc_adm');
    assert.equal(parsed.sources.find((source) => source.code === 'CC_ADUM')?.rowCount, 3);
    assert.equal(parsed.sources.find((source) => source.code === 'CC_PROD')?.rowCount, 0);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_EMPTY' && issue.severity === 'INFO'), true);

    const admDetail = parsed.rows.find((row) => row.logicalSourceCode === 'CC_ADUM' && row.coaCodeRaw === '61110002');
    assert.equal(admDetail?.amount, '10');
    assert.equal(admDetail?.descriptionRaw, 'LIMEST. CONSUMPT.');

    const debit = parsed.rows.find((row) => row.logicalSourceCode === 'CC_ADUM' && row.descriptionRaw === '*  Debit');
    assert.equal(debit?.coaCodeRaw, null);
    assert.equal(debit?.amount, '10');

    const overUnder = parsed.rows.find((row) => row.logicalSourceCode === 'CC_ADUM' && row.descriptionRaw === '** Over/Underabsorption');
    assert.equal(overUnder?.coaCodeRaw, null);
    assert.equal(overUnder?.amount, '10');

    const tbDetail = parsed.rows.find((row) => row.logicalSourceCode === 'TB' && row.coaCodeRaw === '61110002');
    assert.equal(tbDetail?.descriptionRaw, 'Limestone');
    assert.equal(tbDetail?.amount, '5');
  });
});
