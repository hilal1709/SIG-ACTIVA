import type { ClassifiedRow, SourceRow } from './types';

// Intentionally narrow until golden workbooks lock source-specific markers.
export const REPORTED_TOTAL_LABELS = new Set(['TOTAL', 'GRAND TOTAL']);
export const SUBTOTAL_LABELS = new Set(['SUBTOTAL']);
export function normalizedControlLabel(value: string | null) { return (value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toUpperCase(); }

export function classifySourceRow(row: SourceRow): ClassifiedRow {
  const label = normalizedControlLabel(row.descriptionRaw || row.coaCodeRaw);
  if (REPORTED_TOTAL_LABELS.has(label)) return { ...row, kind: 'REPORTED_TOTAL' };
  if (SUBTOTAL_LABELS.has(label)) return { ...row, kind: 'SUBTOTAL' };
  if (!row.coaCodeRaw && !row.descriptionRaw && row.amount === null) return { ...row, kind: 'BLANK' };
  if (row.coaCodeRaw && row.amount !== null) return { ...row, kind: 'DETAIL' };
  return { ...row, kind: 'CONTROL' };
}
