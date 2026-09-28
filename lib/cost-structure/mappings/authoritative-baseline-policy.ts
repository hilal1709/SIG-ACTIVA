import { overlapping, previousDay } from './effective-mapping';

const AUTHORITATIVE_BASELINE_NOTES = new Set([
  'ENGINE1_2000_V2 reviewed SI mapping correction',
  'Golden Company 2000 July 2026 authoritative Summary mapping',
  'Golden Company 2000 July 2026 explicit source exclusion',
  'Company 7000 golden bootstrap from validated July 2026 workbook classification',
]);

type MappingInterval = { validFrom: Date; validTo: Date | null };
type BaselineCandidate = MappingInterval & { note: string | null };

export function authoritativeBaselineStart(fiscalYear: number) {
  return new Date(Date.UTC(fiscalYear, 6, 1));
}

export function isAuthoritativeBaselineCandidate(mapping: BaselineCandidate, fiscalYear: number) {
  const expected = authoritativeBaselineStart(fiscalYear);
  return mapping.validFrom.getTime() === expected.getTime() && Boolean(mapping.note && AUTHORITATIVE_BASELINE_NOTES.has(mapping.note));
}

export function canCreatePredecessorInterval(
  validFrom: Date,
  baselineValidFrom: Date,
  existing: MappingInterval[],
) {
  if (validFrom >= baselineValidFrom) return false;
  const proposed = { validFrom, validTo: previousDay(baselineValidFrom) };
  return !overlapping([...existing, proposed]);
}
