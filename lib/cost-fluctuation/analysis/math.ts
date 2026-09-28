import { Prisma } from '@prisma/client';
import type { MetricStatus } from './types';

export const ZERO = new Prisma.Decimal(0);
export const decimal = (value: Prisma.Decimal.Value) => new Prisma.Decimal(value);
export const financial = (value: Prisma.Decimal.Value) => decimal(value).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const money = (value: Prisma.Decimal) => value.toFixed(2);
export const ratio = (numerator: Prisma.Decimal, denominator: Prisma.Decimal, zeroStatus: MetricStatus) =>
  denominator.isZero() ? { value: null, status: zeroStatus } : { value: numerator.div(denominator).mul(100).toFixed(6), status: 'AVAILABLE' as const };
export function variance(current: Prisma.Decimal, comparison: Prisma.Decimal) {
  const amount = current.sub(comparison);
  if (comparison.isZero() && current.isZero()) return { amount, percent: '0.000000', status: 'AVAILABLE' as const };
  const percentage = ratio(amount, comparison.abs(), 'NM');
  return { amount, percent: percentage.value, status: percentage.status };
}
