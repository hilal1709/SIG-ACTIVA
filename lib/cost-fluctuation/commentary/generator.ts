import { Prisma } from '@prisma/client';
import type { ComparedNode, ComparisonType } from '../analysis/types';

export type ParetoDriver = {
  key: string;
  code: string;
  label: string;
  nodeType: ComparedNode['nodeType'];
  varianceAmount: string;
  rank: number;
  grossImpactShare: string;
  direction: 'PRIMARY' | 'OFFSET' | 'NEUTRAL';
};
export type GeneratedCommentary = { text: string; metadata: Record<string, unknown>; drivers: ParetoDriver[] };

const decimal = (value: string | number) => new Prisma.Decimal(value);
const sign = (value: Prisma.Decimal) => value.cmp(0);
const rupiah = (value: Prisma.Decimal) => {
  const negative = value.isNegative();
  const [whole, fraction = ''] = value.abs().toFixed(2).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return `${negative ? '-' : ''}Rp${grouped}${trimmedFraction ? `,${trimmedFraction}` : ''}`;
};
const percent = (value: string | Prisma.Decimal) => {
  const normalized = value instanceof Prisma.Decimal ? value : decimal(value);
  const [whole, fraction = ''] = normalized.toFixed(2).split('.');
  const trimmedFraction = fraction.replace(/0+$/, '');
  return `${whole}${trimmedFraction ? `,${trimmedFraction}` : ''}%`;
};

export function selectParetoDrivers(parent: ComparedNode): ParetoDriver[] {
  const values = (parent.children ?? [])
    .filter((child) => !decimal(child.varianceAmount).isZero())
    .sort((a, b) => decimal(b.varianceAmount).abs().cmp(decimal(a.varianceAmount).abs()) || a.key.localeCompare(b.key));
  const gross = values.reduce((sum, child) => sum.plus(decimal(child.varianceAmount).abs()), decimal(0));
  if (gross.isZero()) return [];

  const minimum = values.length >= 3 ? 3 : 1;
  const selected: ParetoDriver[] = [];
  const parentDirection = sign(decimal(parent.varianceAmount));
  let cumulative = decimal(0);

  for (const child of values) {
    const childVariance = decimal(child.varianceAmount);
    cumulative = cumulative.plus(childVariance.abs());
    const childDirection = sign(childVariance);
    selected.push({
      key: child.key,
      code: child.code,
      label: child.label,
      nodeType: child.nodeType,
      varianceAmount: child.varianceAmount,
      rank: selected.length + 1,
      grossImpactShare: childVariance.abs().div(gross).toFixed(6),
      direction: parentDirection === 0 ? 'NEUTRAL' : childDirection === parentDirection ? 'PRIMARY' : 'OFFSET',
    });
    const reachedPareto = selected.length >= minimum && cumulative.div(gross).gte('0.8');
    const reachedCap = selected.length >= 10;
    if (reachedPareto || reachedCap) break;
  }
  return selected;
}

function driverLabel(driver: ParetoDriver) {
  if (driver.nodeType === 'COA') return `COA ${driver.code} ${driver.label}`.trim();
  if (driver.nodeType === 'NATURE') return `Nature ${driver.code} ${driver.label}`.trim();
  if (driver.nodeType === 'CALCULATED_ITEM') return `Item perhitungan ${driver.label}`;
  return driver.label;
}

export function generateCommentary(
  node: ComparedNode,
  comparisonType: ComparisonType,
  comparisonLabel: string,
  analysisLineageKey: string,
): GeneratedCommentary | null {
  if (node.nodeType === 'COMPANY' || node.nodeType === 'ANALYSIS_BASIS') return null;

  const current = decimal(node.currentAmount);
  const comparison = decimal(node.comparisonAmount);
  const variance = decimal(node.varianceAmount);
  if (current.isZero() && comparison.isZero()) return null;

  let movement: string;
  if (comparison.isZero() && !current.isZero()) movement = `muncul biaya sebesar ${rupiah(current)}`;
  else if (current.isZero() && !comparison.isZero()) movement = `tidak lagi terdapat biaya dan turun menjadi nol dari ${rupiah(comparison)}`;
  else if (variance.isZero()) movement = `secara neto tidak berubah pada ${rupiah(current)}`;
  else movement = `${variance.isPositive() ? 'meningkat' : 'menurun'} ${rupiah(variance.abs())}`;

  const pct = !variance.isZero() && node.variancePercentStatus === 'AVAILABLE' && node.variancePercent !== null
    ? ` atau ${percent(node.variancePercent)}`
    : '';
  const drivers = node.nodeType === 'COST_GROUP' || node.nodeType === 'NATURE' ? selectParetoDrivers(node) : [];
  const primary = drivers.filter((driver) => driver.direction === 'PRIMARY');
  const offsets = drivers.filter((driver) => driver.direction === 'OFFSET');
  const neutral = drivers.filter((driver) => driver.direction === 'NEUTRAL');
  const describe = (driver: ParetoDriver) => `${driverLabel(driver)} (${rupiah(decimal(driver.varianceAmount))}; dampak bruto Pareto ${percent(decimal(driver.grossImpactShare).times(100))})`;
  const distributed = drivers.length >= 3 && decimal(drivers[0]?.grossImpactShare ?? '1').lt('0.4');

  let text = `${node.nodeType === 'CALCULATED_ITEM' ? 'Item perhitungan' : 'Biaya'} ${node.label} ${movement}${pct} dibanding ${comparisonLabel}.`;
  if (primary.length) {
    text += ` ${distributed ? 'Perubahan tersebar pada beberapa driver utama' : 'Perubahan terutama berasal dari'}: ${primary.map(describe).join('; ')}.`;
  }
  if (offsets.length) text += ` Perubahan tersebut sebagian di-offset oleh: ${offsets.map(describe).join('; ')}.`;
  if (neutral.length) text += ` Meskipun perubahan neto nol, terdapat pergeseran antar-driver utama: ${neutral.map(describe).join('; ')}.`;
  text += ' Uraian ini hanya menjelaskan pergerakan kuantitatif; penyebab bisnis perlu dilengkapi oleh pengguna.';

  return {
    text,
    drivers,
    metadata: {
      comparisonType,
      analysisKey: node.key,
      currentAmount: node.currentAmount,
      comparisonAmount: node.comparisonAmount,
      varianceAmount: node.varianceAmount,
      variancePercent: node.variancePercent,
      variancePercentStatus: node.variancePercentStatus,
      selectedParetoDrivers: drivers,
      analysisLineageKey,
      generatorVersion: 'PARETO_COMMENTARY_V1',
    },
  };
}

export function attachSuggestions<T extends ComparedNode>(
  nodes: T[],
  comparisonType: ComparisonType,
  label: string,
  lineage: string,
): Array<T & { suggestedCommentary?: GeneratedCommentary }> {
  return nodes.map((node) => {
    const suggestedCommentary = generateCommentary(node, comparisonType, label, lineage);
    return {
      ...node,
      ...(suggestedCommentary ? { suggestedCommentary } : {}),
      children: node.children ? attachSuggestions(node.children, comparisonType, label, lineage) : undefined,
    };
  }) as Array<T & { suggestedCommentary?: GeneratedCommentary }>;
}
