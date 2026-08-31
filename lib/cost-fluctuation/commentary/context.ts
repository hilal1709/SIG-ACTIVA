import { createHash } from 'node:crypto';
import type { ComparedNode, ComparisonType, Lineage } from '../analysis/types';

export function lineageKey(comparisonType: ComparisonType, current: Lineage[], comparison: Lineage[]) {
  const canonical = JSON.stringify({ comparisonType, current: [...current].sort((a, b) => a.periodId - b.periodId), comparison: [...comparison].sort((a, b) => a.periodId - b.periodId) });
  return createHash('sha256').update(canonical).digest('hex');
}

function locate(nodes: ComparedNode[], key: string, parent?: { groupId?: number; natureId?: number }): { node: ComparedNode; groupId: number; natureId: number | null } | null {
  for (const node of nodes) {
    const next = { groupId: node.nodeType === 'COST_GROUP' ? node.id ?? undefined : parent?.groupId, natureId: node.nodeType === 'NATURE' ? node.id ?? undefined : parent?.natureId };
    if (node.key === key && node.nodeType !== 'COMPANY' && next.groupId) return { node, groupId: next.groupId, natureId: next.natureId ?? null };
    const found = node.children && locate(node.children, key, next); if (found) return found;
  }
  return null;
}

export async function resolveCommentaryTarget(periodId: number, comparisonType: ComparisonType, analysisKey: string) {
  const { getCostFluctuationAnalysis } = await import('../analysis/service');
  const analysis = await getCostFluctuationAnalysis(periodId, comparisonType);
  if (analysis.kind !== 'OK' || analysis.status !== 'AVAILABLE') throw new Error('Comparison must be AVAILABLE for commentary.');
  const target = locate(analysis.hierarchy, analysisKey);
  if (!target) throw new Error('Analysis target is not part of the current hierarchy.');
  const level = target.node.nodeType;
  if (level === 'COMPANY') throw new Error('Company commentary is not applicable.');
  return { analysis, target, analysisLineageKey: lineageKey(comparisonType, analysis.current.periods, analysis.comparison.periods), analysisLevel: level, coaId: level === 'COA' ? target.node.id : null, calculatedItemKey: level === 'CALCULATED_ITEM' ? target.node.key : null };
}
