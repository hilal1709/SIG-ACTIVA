import type { BlueprintCellStyle, SheetStyleBlueprint } from './types';

export const ACCOUNTING_FORMAT = '#,##0.00;[Red](#,##0.00);-';
const GRAY_FILL: BlueprintCellStyle['fill'] = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF2F2F2' } };

/**
 * Compatibility styles reproduce only behavior that already existed in the exporter.
 * They deliberately avoid invented template colors/borders while exact July template metadata
 * is still pending. Exact template fidelity therefore remains false.
 */
export const compatibilityStyleCatalog = {
  summaryLabel: { font: { name: 'Arial', size: 10, bold: false } },
  summaryLabelRedBold: { font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFC00000' } } },
  summaryLabelGrayBold: { font: { name: 'Arial', size: 10, bold: true }, fill: GRAY_FILL },
  summaryLabelGray: { font: { name: 'Arial', size: 10, bold: false }, fill: GRAY_FILL },
  summaryAmount: { font: { name: 'Arial', size: 10, bold: false }, numFmt: ACCOUNTING_FORMAT },
  summaryAmountGrayBold: { font: { name: 'Arial', size: 10, bold: true }, fill: GRAY_FILL, numFmt: ACCOUNTING_FORMAT },
  amountOnly: { numFmt: ACCOUNTING_FORMAT },
  rincianHeader: {
    font: { name: 'Calibri', size: 11, bold: true },
    alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
  },
} satisfies Record<string, BlueprintCellStyle>;

/**
 * CC sheets are registered now so approved static template metadata can be dropped in later.
 * Until then this blueprint is intentionally a no-op and preserves the current exporter output.
 */
export function detailSheet(aliases: string[] = []): SheetStyleBlueprint {
  return { aliases, styleCatalog: {} };
}

/** Known layout/style behavior from the pre-blueprint exporter. */
export function rincianSheet(aliases: string[] = []): SheetStyleBlueprint {
  const widths: Record<string, number> = {
    B:11.44,C:29.78,D:23.44,E:22.22,F:22.78,G:25.22,H:25.22,I:21.44,J:22.78,K:19,L:20.22,
    M:28.22,N:29.78,O:16.78,Q:11,R:17.78,S:22.22,T:15.78,U:16.22,W:10.22,X:16.22,Y:26,Z:26,AA:26,
  };
  const amountColumns = ['D','E','F','G','H','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X'];
  return {
    aliases,
    styleCatalog: compatibilityStyleCatalog,
    views: [{ state: 'frozen', xSplit: 3, ySplit: 381, topLeftCell: 'D382' }],
    pageSetup: { orientation: 'portrait' },
    autoFilter: 'B3:AA3',
    autoFilterMinRowCount: 3,
    columns: [
      ...Object.entries(widths).map(([key, width]) => ({ key, width })),
      ...amountColumns.map((key) => ({ key, styleRole: 'amountOnly' })),
    ],
    rows: [{ index: 3, styleRole: 'rincianHeader' }],
  };
}
