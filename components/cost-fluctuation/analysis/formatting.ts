function fixedDecimal(value: string, fractionDigits: number): { negative: boolean; whole: string; fraction: string } | null {
  const match = /^([+-]?)(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) return null;

  const negative = match[1] === '-';
  const whole = match[2].replace(/^0+(?=\d)/, '') || '0';
  const sourceFraction = match[3] ?? '';
  const scale = 10n ** BigInt(fractionDigits);
  let scaled = BigInt(whole) * scale;

  if (fractionDigits > 0) {
    const kept = sourceFraction.padEnd(fractionDigits, '0').slice(0, fractionDigits);
    scaled += BigInt(kept || '0');
  }

  const nextDigit = sourceFraction[fractionDigits] ?? '0';
  if (nextDigit >= '5') scaled += 1n;

  const scaledWhole = scaled / scale;
  const scaledFraction = fractionDigits > 0
    ? (scaled % scale).toString().padStart(fractionDigits, '0')
    : '';

  return {
    negative: negative && scaled !== 0n,
    whole: scaledWhole.toString(),
    fraction: scaledFraction,
  };
}

function groupIdDigits(value: string) {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatIdr(value: string | null | undefined) {
  if (value === null || value === undefined) return '—';
  const parsed = fixedDecimal(value, 2);
  if (!parsed) return '—';
  const sign = parsed.negative ? '-' : '';
  return `${sign}Rp\u00a0${groupIdDigits(parsed.whole)},${parsed.fraction}`;
}

export function formatPercent(value: string | null | undefined, status?: string) {
  if (status === 'NM') return 'N/M';
  if (value === null || value === undefined) return status === 'PARENT_ZERO' ? 'Parent 0' : '—';
  const parsed = fixedDecimal(value, 2);
  if (!parsed) return '—';
  const sign = parsed.negative ? '-' : '';
  return `${sign}${groupIdDigits(parsed.whole)},${parsed.fraction}%`;
}

export function periodLabel(year: number, period: number) {
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(Date.UTC(year, period - 1, 1)));
}
