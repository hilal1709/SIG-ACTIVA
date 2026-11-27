import type { ClassifiedRow, SourceRow } from './types';

// Narrow labels verified against the July-2026 Company 2000 SAP CC workbook.
export const REPORTED_TOTAL_LABELS = new Set(['TOTAL', 'GRAND TOTAL', 'DEBIT']);
export const SUBTOTAL_LABELS = new Set(['SUBTOTAL', 'OVER/UNDERABSORPTION', 'OVER/UND']);
export function normalizedControlLabel(value: string | null) {
  return (value || '')
    .normalize('NFKC')
    .trim()
    .replace(/^\*+\s*/, '')
    .replace(/\s+/g, ' ')
    .toUpperCase();
}

export function classifySourceRow(row: SourceRow): ClassifiedRow {
  const label = normalizedControlLabel(row.descriptionRaw || row.coaCodeRaw);
  if (REPORTED_TOTAL_LABELS.has(label)) return { ...row, kind: 'REPORTED_TOTAL' };
  if (SUBTOTAL_LABELS.has(label)) return { ...row, kind: 'SUBTOTAL' };
  if (!row.coaCodeRaw && !row.descriptionRaw && row.amount === null) return { ...row, kind: 'BLANK' };
  if (row.coaCodeRaw && row.amount !== null) return { ...row, kind: 'DETAIL' };
  return { ...row, kind: 'CONTROL' };
}
