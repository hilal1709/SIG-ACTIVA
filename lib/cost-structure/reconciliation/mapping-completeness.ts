import { fromMinor, isMappingBlockingAmount, toMinor } from './money';

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

  const undisposedByCoa = new Map<string, bigint>();
  for (const row of rows) {
    if (DISPOSED.has(row.mappingStatus)) continue;
    const key = `${row.logicalSourceCode}:${row.coaCodeRaw ?? '<missing>'}`;
    undisposedByCoa.set(key, (undisposedByCoa.get(key) ?? BigInt(0)) + toMinor(row.amount));
  }

  const blocking = [...undisposedByCoa.entries()].filter(([, amount]) => isMappingBlockingAmount(fromMinor(amount)));
  const deMinimis = [...undisposedByCoa.entries()].filter(([, amount]) => !isMappingBlockingAmount(fromMinor(amount)) && amount !== BigInt(0));
  const blockingDifference = blocking.reduce((sum, [, amount]) => sum + amount, BigInt(0));

  return {
    mappedAmount: fromMinor(mapped),
    excludedAmount: fromMinor(excluded),
    reclassifiedAmount: fromMinor(reclassified),
    unmappedAmount: fromMinor(unmapped),
    difference: fromMinor(difference),
    blockingDifference: fromMinor(blockingDifference),
    unmappedCoaCount: blocking.length,
    deMinimisUnmappedCoaCount: deMinimis.length,
  };
}
