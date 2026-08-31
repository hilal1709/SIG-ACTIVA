import { compatibilityStyleCatalog, detailSheet, rincianSheet } from './common';
import type { WorkbookStyleBlueprint } from './types';

export const company2000StyleBlueprint: WorkbookStyleBlueprint = {
  templateVersion: 'compatibility-v1-awaiting-approved-july-style-dataset',
  companyCode: '2000',
  exactTemplateFidelity: false,
  sheets: {
    SI: {
      aliases: ['si'],
      styleCatalog: compatibilityStyleCatalog,
      views: [{ state: 'frozen', xSplit: 1, ySplit: 1, topLeftCell: 'B2' }],
      columns: [
        { key: 'A', width: 53 },
        { key: 'B', width: 18, styleRole: 'amountOnly' },
      ],
      pageSetup: { orientation: 'portrait', printArea: 'A1:B43' },
    },
    'rincian biaya': rincianSheet(['rincian_biaya']),
    'cc ADM': detailSheet(['cc_adm', 'cc adm']),
    'cc pasar': detailSheet(['cc_pasar']),
  },
};
