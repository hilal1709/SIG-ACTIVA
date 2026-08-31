import type { MaterialityNode } from '../materiality/types';

export type ReviewRow = { key: string; materialityStatus: string; commentaryStatus?: string };
export type ScopedReviewNode = { node: MaterialityNode; groupId: number | null };

export function scopeReviewNodes(nodes: MaterialityNode[], parentGroupId: number | null = null): ScopedReviewNode[] {
  return nodes.flatMap((node) => {
    const groupId = node.nodeType === 'COST_GROUP' ? node.id : parentGroupId;
    return [{ node, groupId }, ...scopeReviewNodes(node.children ?? [], groupId)];
  });
}

export function readiness(periodStatus: string, analyses: Array<{ available: boolean; rows: ReviewRow[] }>) {
  const blockers: string[] = [];
  if (periodStatus !== 'FINALIZED') blockers.push('FINALIZED');
  const available = analyses.filter((analysis) => analysis.available);
  if (!available.length) blockers.push('AVAILABLE');
  for (const analysis of available) for (const row of analysis.rows) {
    if (['NOT_CONFIGURED', 'NOT_EVALUABLE'].includes(row.materialityStatus)) blockers.push(row.materialityStatus);
    if (row.materialityStatus === 'REQUIRES_EXPLANATION' && row.commentaryStatus !== 'REVIEWED') blockers.push(`${row.key}:${row.commentaryStatus ?? 'OPEN'}`);
  }
  return { ready: blockers.length === 0, blockers };
}
