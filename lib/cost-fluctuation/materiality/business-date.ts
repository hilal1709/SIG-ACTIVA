export function parseBusinessDate(value: unknown, field: string, boundary: 'start' | 'end', optional = false) {
  if ((value === null || value === undefined || value === '') && optional) return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${field} must use YYYY-MM-DD.`);
  const [year, month, day] = value.split('-').map(Number);
  const end = boundary === 'end';
  const result = new Date(Date.UTC(year, month - 1, day, end ? 23 : 0, end ? 59 : 0, end ? 59 : 0, end ? 999 : 0));
  if (result.getUTCFullYear() !== year || result.getUTCMonth() !== month - 1 || result.getUTCDate() !== day) throw new Error(`${field} must be a valid business date.`);
  return result;
}

export const predecessorEndForSuccessor = (successorValidFrom: Date) => new Date(successorValidFrom.getTime() - 1);
