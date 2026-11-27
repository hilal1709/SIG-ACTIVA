import { compatibilityStyleCatalog, detailSheet, rincianSheet } from './common';
import type { SheetStyleBlueprint, WorkbookStyleBlueprint } from './types';

const summarySheet: SheetStyleBlueprint = {
  styleCatalog: compatibilityStyleCatalog,
  views: [{ state: 'frozen', xSplit: 0, ySplit: 1, topLeftCell: 'A2' }],
  columns: [
    { key: 'A', width: 53.78 },
    { key: 'B', width: 18 },
    { key: 'C', width: 14.44, hidden: true },
    { key: 'D', width: 21.22, hidden: true },
    { key: 'E', width: 12.44, hidden: true },
    { key: 'F', width: 11.44, hidden: true },
    { key: 'G', width: 10.44, hidden: true },
    { key: 'H', width: 9.22, hidden: true },
    { key: 'I', width: 36.22, hidden: true },
    { key: 'J', width: 12.78, hidden: true },
    { key: 'K', width: 18.78 },
    { key: 'L', width: 14.78 },
    { key: 'M', width: 12.22 },
    { key: 'N', width: 16.44 },
    { key: 'O', width: 9.22 },
    { key: 'R', width: 16.44 },
    { key: 'S', width: 12.44 },
    { key: 'T', width: 11.44 },
    { key: 'U', width: 11.78 },
    { key: 'V', width: 9.22 },
  ],
  rows: [20, 46, 47, 48, 49, 50].map((index) => ({ index, hidden: true })),
  pageSetup: { orientation: 'portrait', printArea: 'A1:B47' },
  repeatingRanges: [
    { fromColumn: 'A', toColumn: 'A', fromRow: 1, minimumToRow: 55, styleRole: 'summaryLabel' },
    { fromColumn: 'B', toColumn: 'B', fromRow: 1, minimumToRow: 55, styleRole: 'summaryAmount' },
  ],
  ranges: [
    ...[2, 22, 34].map((row) => ({ range: `A${row}`, styleRole: 'summaryLabelRedBold' })),
    ...[19, 32, 44].map((row) => ({ range: `A${row}`, styleRole: 'summaryLabelGrayBold' })),
    ...[19, 32, 44].map((row) => ({ range: `B${row}`, styleRole: 'summaryAmountGrayBold' })),
    { range: 'A45', styleRole: 'summaryLabelGray' },
    { range: 'B45', styleRole: 'summaryAmountGrayBold' },
  ],
};

export const company7000StyleBlueprint: WorkbookStyleBlueprint = {
  templateVersion: 'compatibility-v1-awaiting-approved-july-style-dataset',
  companyCode: '7000',
  exactTemplateFidelity: false,
  sheets: {
    GHoPO: { ...summarySheet, aliases: ['ghopo', 'GHOPO'] },
    DERIV: { ...summarySheet, aliases: ['deriv'] },
    'rincian biaya': rincianSheet(['rincian_biaya']),
    cc_prod: detailSheet(['cc prod']),
    cc_adm: detailSheet(['cc ADM', 'cc adm']),
    'cc pasar': detailSheet(['cc_pasar']),
  },
};
