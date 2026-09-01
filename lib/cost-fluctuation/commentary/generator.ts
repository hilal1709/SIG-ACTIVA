import type { ComparedNode, ComparisonType } from '../analysis/types';

export type ParetoDriver = {
  key: string; label: string; nodeType: ComparedNode['nodeType']; varianceAmount: string;
  rank: number; grossImpactShare: string; direction: 'PRIMARY' | 'OFFSET';
};
export type GeneratedCommentary = { text: string; metadata: Record<string, unknown>; drivers: ParetoDriver[] };

const amount = (value: string) => Number(value);
const rupiah = (value: number) => `${value < 0 ? '-' : ''}Rp${Math.abs(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })}`;
const percent = (value: string) => `${Number(value).toLocaleString('id-ID', { maximumFractionDigits: 2 })}%`;

export function selectParetoDrivers(parent: ComparedNode): ParetoDriver[] {
  const values = (parent.children ?? []).filter((child) => amount(child.varianceAmount) !== 0)
    .sort((a, b) => Math.abs(amount(b.varianceAmount)) - Math.abs(amount(a.varianceAmount)) || a.key.localeCompare(b.key));
  const gross = values.reduce((sum, child) => sum + Math.abs(amount(child.varianceAmount)), 0);
  if (!gross) return [];
  const minimum = values.length >= 3 ? 3 : 1;
  const selected: ParetoDriver[] = [];
  let cumulative = 0;
  for (const child of values) {
    cumulative += Math.abs(amount(child.varianceAmount));
    selected.push({ key: child.key, label: child.label, nodeType: child.nodeType, varianceAmount: child.varianceAmount,
      rank: selected.length + 1, grossImpactShare: (Math.abs(amount(child.varianceAmount)) / gross).toFixed(6),
      direction: Math.sign(amount(child.varianceAmount)) === Math.sign(amount(parent.varianceAmount)) ? 'PRIMARY' : 'OFFSET' });
    if (selected.length >= minimum && cumulative / gross >= .8 || selected.length === 10) break;
  }
  return selected;
}

export function generateCommentary(node: ComparedNode, comparisonType: ComparisonType, comparisonLabel: string, analysisLineageKey: string): GeneratedCommentary | null {
  if (node.nodeType === 'COMPANY' || node.nodeType === 'ANALYSIS_BASIS') return null;
  const current = amount(node.currentAmount), comparison = amount(node.comparisonAmount), variance = amount(node.varianceAmount);
  if (current === 0 && comparison === 0) return null;
  let movement: string;
  if (comparison === 0 && current !== 0) movement = `muncul biaya sebesar ${rupiah(current)}`;
  else if (current === 0 && comparison !== 0) movement = `tidak lagi terdapat biaya dan turun menjadi nol dari ${rupiah(comparison)}`;
  else movement = `${variance > 0 ? 'meningkat' : 'menurun'} ${rupiah(Math.abs(variance))}`;
  const pct = node.variancePercentStatus === 'AVAILABLE' && node.variancePercent !== null ? ` atau ${percent(node.variancePercent)}` : '';
  const drivers = node.nodeType === 'COST_GROUP' || node.nodeType === 'NATURE' ? selectParetoDrivers(node) : [];
  const primary = drivers.filter((driver) => driver.direction === 'PRIMARY');
  const offsets = drivers.filter((driver) => driver.direction === 'OFFSET');
  const describe = (driver: ParetoDriver) => `${driver.nodeType === 'COA' ? 'COA ' : ''}${driver.label} (${rupiah(amount(driver.varianceAmount))}; dampak bruto Pareto ${percent(String(Number(driver.grossImpactShare) * 100))})`;
  const distributed = drivers.length >= 3 && Number(drivers[0]?.grossImpactShare ?? 1) < .4;
  let text = `${node.nodeType === 'CALCULATED_ITEM' ? 'Item perhitungan' : 'Biaya'} ${node.label} ${movement}${pct} dibanding ${comparisonLabel}.`;
  if (primary.length) text += ` ${distributed ? 'Perubahan tersebar pada beberapa driver utama' : 'Perubahan terutama berasal dari'}: ${primary.map(describe).join('; ')}.`;
  if (offsets.length) text += ` Perubahan tersebut sebagian di-offset oleh: ${offsets.map(describe).join('; ')}.`;
  text += ' Uraian ini hanya menjelaskan pergerakan kuantitatif; penyebab bisnis perlu dilengkapi oleh pengguna.';
  return { text, drivers, metadata: { comparisonType, analysisKey: node.key, currentAmount: node.currentAmount, comparisonAmount: node.comparisonAmount,
    varianceAmount: node.varianceAmount, variancePercent: node.variancePercent, variancePercentStatus: node.variancePercentStatus,
    selectedParetoDrivers: drivers, analysisLineageKey, generatorVersion: 'PARETO_COMMENTARY_V1' } };
}

export function attachSuggestions<T extends ComparedNode>(nodes: T[], comparisonType: ComparisonType, label: string, lineage: string): Array<T & { suggestedCommentary?: GeneratedCommentary }> {
  return nodes.map((node) => ({ ...node, ...(generateCommentary(node, comparisonType, label, lineage) ? { suggestedCommentary: generateCommentary(node, comparisonType, label, lineage)! } : {}),
    children: node.children ? attachSuggestions(node.children, comparisonType, label, lineage) : undefined })) as Array<T & { suggestedCommentary?: GeneratedCommentary }>;
}
