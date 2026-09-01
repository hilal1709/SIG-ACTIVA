export type Interval = { id?: number; validFrom: Date; validTo: Date | null };

export function appliesAt(mapping: Interval, effectiveDate: Date) {
  return mapping.validFrom <= effectiveDate && (mapping.validTo === null || mapping.validTo >= effectiveDate);
}

export function overlapping(intervals: Interval[]) {
  return intervals.some((left, index) =>
    intervals.slice(index + 1).some((right) =>
      left.validFrom <= (right.validTo ?? new Date(8640000000000000)) &&
      right.validFrom <= (left.validTo ?? new Date(8640000000000000))
    )
  );
}

export function previousDay(date: Date) {
  const value = new Date(date);
  value.setUTCDate(value.getUTCDate() - 1);
  return value;
}

export function validToBeforeNext(effectiveDate: Date, intervals: Interval[]) {
  const next = intervals
    .filter((interval) => interval.validFrom > effectiveDate)
    .sort((left, right) => left.validFrom.getTime() - right.validFrom.getTime())[0];
  return next ? previousDay(next.validFrom) : null;
}

export function boundBeforeProtectedPeriod(candidateValidTo: Date | null, protectedPeriodStart: Date | null) {
  if (!protectedPeriodStart) return candidateValidTo;
  const protectedCutoff = previousDay(protectedPeriodStart);
  return candidateValidTo === null || protectedCutoff < candidateValidTo ? protectedCutoff : candidateValidTo;
}
