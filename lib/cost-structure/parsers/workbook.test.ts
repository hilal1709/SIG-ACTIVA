import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import ExcelJS from 'exceljs';
import { parseWorkbook } from './workbook';
import { reconcileCcGroup } from '../reconciliation/reconcile-cc-group';

describe('parseWorkbook raw support-source lineage', () => {
  it('uses only the first Debit section for Company 7000 CC source controls', async () => {
    const workbook = new ExcelJS.Workbook();
    workbook.addWorksheet('tb').addRows([['kode','descr','amount'],['50000001','x',1]]);
    const totals: Record<string, number> = { cc_prod:323678831230, cc_adm:8559756291, 'cc pasar':10648498072, WHRPG:4589161539 };
    for (const [name,total] of Object.entries(totals)) {
      const sheet=workbook.addWorksheet(name); sheet.addRow(['Cost Elements','Act. Costs']);
      sheet.addRow(['60000001 Primary',total]); sheet.addRow(['* Debit',total]);
      sheet.addRow(['* Credit',999]); sheet.addRow(['60000002 post debit',999]);
    }
    for(const name of ['Batu bara','beli','solar PP order','statistical pasar']) workbook.addWorksheet(name).addRow(['support']);
    const parsed=await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer() as ArrayBuffer),'7000');
    for(const [name,total] of Object.entries(totals)) {
      const source=name==='cc_prod'?'CC_PROD':name==='cc_adm'?'CC_ADUM':name==='cc pasar'?'CC_PASAR':'CC_WHRPG';
      const sourceRows=parsed.rows.filter(row=>row.logicalSourceCode===source);
      assert.equal(sourceRows.length,2); assert.equal(sourceRows[0].amount,String(total)); assert.equal(sourceRows[1].descriptionRaw,'* Debit');
      assert.equal(sourceRows.some(row=>row.coaCodeRaw==='60000002'),false);
      const control=reconcileCcGroup(sourceRows.map(row=>({coaCodeRaw:row.coaCodeRaw,descriptionRaw:row.descriptionRaw,amount:row.amount})));
      assert.equal(control.status,'RECONCILED'); assert.equal(control.detailAmount,`${total}.00`); assert.equal(control.difference,'0.00');
    }
  });
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

  it('prefers authoritative Cost Elements / Act. Costs and ignores SAP control/layout artifacts', async () => {
    const workbook = new ExcelJS.Workbook();
    const tb = workbook.addWorksheet('tb');
    tb.addRow(['', '', '', '', '', '', '', 'kode ', 'descr', 'amount']);
    tb.addRow(['', '', '', '', '', '', '', '61110002', 'Limestone', 5]);
    // SAP metadata row: non-empty elsewhere, but authoritative kode/descr/amount fields are empty.
    tb.addRow(['Company code currenc 10', 'Rupiah IDR', 'metadata only']);

    workbook.addWorksheet('cc_prod');

    for (const name of ['cc_adm', 'cc pasar']) {
      const sheet = workbook.addWorksheet(name);
      for (let i = 1; i < 13; i += 1) sheet.addRow([]);
      sheet.addRow(['', '', 'Cost Elements', 'Act. Costs', '', '', '', '', '', '', '', '', 'CE', 'Act Amt', 'Group CE']);
      sheet.addRow(['', '', '   61110002  LIMEST. CONSUMPT.', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C14,8)' }, { formula: 'D14' }, '6']);
      sheet.addRow(['', '', '*  Debit', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C15,8)' }, { formula: 'D15' }, 'D']);
      sheet.addRow(['', '', '** Over/Underabsorption', 10, '', '', '', '', '', '', '', '', { formula: 'LEFT(C16,8)' }, { formula: 'D16' }, 'O']);
      // Helper/formula tail remains non-empty while authoritative Cost Elements / Act. Costs are empty.
      sheet.addRow(['', '', '', '', '', '', '', '', '', '', '', '', '', 0, '']);
    }

    const bytes = await workbook.xlsx.writeBuffer();
    const parsed = await parseWorkbook(new Uint8Array(bytes as ArrayBuffer), '2000');

    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'REQUIRED_SOURCE_MISSING'), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_HEADER_NOT_FOUND' && issue.severity === 'ERROR'), false);
    assert.equal(parsed.issues.some((issue) => issue.issueCode === 'SOURCE_ROW_MISSING_COA'), false);
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
    assert.equal(parsed.rows.some((row) => row.logicalSourceCode === 'TB' && row.sourceRowNumber === 3), false);
  });
});
