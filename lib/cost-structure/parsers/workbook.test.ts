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

  it('parses the verified Company 2000 SAP layout and accepts the structural empty cc_prod sheet', async () => {
    const workbook = new ExcelJS.Workbook();
    const tb = workbook.addWorksheet('tb');
    tb.addRow(['', '', '', '', '', '', '', 'kode ', 'descr', 'amount']);
    tb.addRow(['', '', '', '', '', '', '', '61110002', 'Limestone', 5]);

    workbook.addWorksheet('cc_prod');

    for (const name of ['cc_adm', 'cc pasar']) {
      const sheet = workbook.addWorksheet(name);
      for (let i = 1; i < 13; i += 1) sheet.addRow([]);
      sheet.addRow(['', '', 'Cost Elements', 'Act. Costs', '', '', '', '', '', '', '', '', 'CE', 'Act Amt', 'Group CE']);
      sheet.addRow(['', '', '   61110002  LIMEST. CONSUMPT.', 10, '', '', '', '', '', '', '', '', '61110002', 10, '6']);
      sheet.addRow(['', '', '*  Debit', 10, '', '', '', '', '', '', '', '', 'Debit', 10, 'D']);
      sheet.addRow(['', '', '** Over/Underabsorption', 10, '', '', '', '', '', '', '', '', 'Over/Und', 10, 'O']);
      sheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', 0, '']);
    }

    const bytes = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(bytes as unknown as Uint8Array, '2000');

    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'REQUIRED_SOURCE_MISSING'), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_HEADER_NOT_FOUND' && issue.severity === 'ERROR'), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_ROW_MISSING_COA'), false);
    assert.equal(parsed.sources.find((source) => source.code === 'CC_ADUM')?.sheetName, 'cc_adm');
    assert.equal(parsed.sources.find((source) => source.code === 'CC_ADUM')?.rowCount, 3);
    assert.equal(parsed.sources.find((source) => source.code === 'CC_PROD')?.rowCount, 0);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_EMPTY' && issue.severity === 'INFO'), true);

    const admDetail = parsed.rows.find((row) => row.logicalSourceCode === 'CC_ADUM' && row.coaCodeRaw === '61110002');
    assert.equal(admDetail?.amount, '10');
    assert.equal(admDetail?.descriptionRaw, '61110002  LIMEST. CONSUMPT.');

    const tbDetail = parsed.rows.find((row) => row.logicalSourceCode === 'TB' && row.coaCodeRaw === '61110002');
    assert.equal(tbDetail?.descriptionRaw, 'Limestone');
    assert.equal(tbDetail?.amount, '5');
  });
});
