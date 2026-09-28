export const MAPPING_DE_MINIMIS_MINOR = BigInt(100);

export function toMinor(value: string | null): bigint {
  if (value === null) return BigInt(0);
  const match = value.trim().match(/^(-?)(\d+)(?:\.(\d{1,2}))?$/);
  if (!match) throw new Error(`Invalid normalized Decimal amount: ${value}`);
  const minor = BigInt(match[2]) * BigInt(100) + BigInt((match[3] || '').padEnd(2, '0'));
  return match[1] ? -minor : minor;
}

export function fromMinor(value: bigint): string {
  const sign = value < BigInt(0) ? '-' : '';
  const absolute = value < BigInt(0) ? -value : value;
  return `${sign}${absolute / BigInt(100)}.${String(absolute % BigInt(100)).padStart(2, '0')}`;
}

export function isMappingBlockingAmount(value: string | null): boolean {
  const minor = toMinor(value);
  const absolute = minor < BigInt(0) ? -minor : minor;
  return absolute > MAPPING_DE_MINIMIS_MINOR;
}
