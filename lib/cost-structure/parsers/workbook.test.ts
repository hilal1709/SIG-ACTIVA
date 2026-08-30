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
});
