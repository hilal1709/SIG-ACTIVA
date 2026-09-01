import { fromMinor, toMinor } from './money';

export type MappingCompletenessRow = {
  logicalSourceCode: string;
  coaCodeRaw: string | null;
  amount: string | null;
  mappingStatus: string;
};

const DISPOSED = new Set(['MAPPED', 'EXCLUDED', 'RECLASSIFIED']);

export function calculateMappingCompleteness(rows: MappingCompletenessRow[]) {
  const total = (status: string) => rows
    .filter((row) => row.mappingStatus === status)
    .reduce((sum, row) => sum + toMinor(row.amount), BigInt(0));

  const validated = rows.reduce((sum, row) => sum + toMinor(row.amount), BigInt(0));
  const mapped = total('MAPPED');
  const excluded = total('EXCLUDED');
  const reclassified = total('RECLASSIFIED');
  const unmapped = total('UNMAPPED');
  const difference = validated - mapped - excluded - reclassified;

  const undisposedNonZero = new Set(
    rows
      .filter((row) => !DISPOSED.has(row.mappingStatus) && toMinor(row.amount) !== BigInt(0))
      .map((row) => `${row.logicalSourceCode}:${row.coaCodeRaw ?? '<missing>'}`)
  );

  return {
    mappedAmount: fromMinor(mapped),
    excludedAmount: fromMinor(excluded),
    reclassifiedAmount: fromMinor(reclassified),
    unmappedAmount: fromMinor(unmapped),
    difference: fromMinor(difference),
    unmappedCoaCount: undisposedNonZero.size,
  };
}
