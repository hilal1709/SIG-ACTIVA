import type { ComparisonType } from './analysis/types';

export const COMPARISON_TYPES = ['MOM', 'YOY', 'YTD'] as const;
export const MATERIALITY_OPERATORS = ['AND', 'OR'] as const;

export function positiveSafeInteger(value: unknown, field: string): number {
  const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new Error(`${field} must be a positive safe integer.`);
  return parsed;
}

export function comparisonType(value: unknown): ComparisonType {
  if (typeof value !== 'string' || !COMPARISON_TYPES.includes(value as ComparisonType)) throw new Error('comparisonType must be MOM, YOY, or YTD.');
  return value as ComparisonType;
}

export async function jsonBody(request: Request): Promise<Record<string, unknown>> {
  try { const body: unknown = await request.json(); if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error(); return body as Record<string, unknown>; }
  catch { throw new Error('Request body must be valid JSON object.'); }
}

export function boundedText(value: unknown, field: string, required = false): string {
  if (value == null && !required) return '';
  if (typeof value !== 'string') throw new Error(`${field} must be text.`);
  const result = value.trim();
  if (required && !result) throw new Error(`${field} is required.`);
  if (result.length > 5000) throw new Error(`${field} must not exceed 5000 characters.`);
  return result;
}
