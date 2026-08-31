import type { AnalysisNode, Commentary, Filters } from './types';

export type VisibleRow = AnalysisNode & { depth: number; hasChildren: boolean };
const CONTEXT = new Set(['COMPANY', 'ANALYSIS_BASIS']);

export const isCommentaryTarget = (node: AnalysisNode) => !CONTEXT.has(node.nodeType);
export const commentaryStatus = (node: AnalysisNode, statuses: Map<string, string>) =>
  isCommentaryTarget(node) ? statuses.get(node.key) ?? (node.materialityStatus === 'REQUIRES_EXPLANATION' ? 'OPEN' : '—') : '—';

export function collectOptions(nodes: AnalysisNode[]) {
  const groups = new Map<string, string>();
  const natures = new Map<string, string>();

  const visit = (node: AnalysisNode, basisCode = '', groupLabel = '') => {
    const nextBasis = node.nodeType === 'ANALYSIS_BASIS' ? node.code : basisCode;
    const nextGroupLabel = node.nodeType === 'COST_GROUP' ? `${node.code} — ${node.label}` : groupLabel;

    if (node.nodeType === 'COST_GROUP') {
      groups.set(node.key, [nextBasis, nextGroupLabel].filter(Boolean).join(' · '));
    }
    if (node.nodeType === 'NATURE') {
      natures.set(node.key, [nextBasis, groupLabel, node.label].filter(Boolean).join(' · '));
    }
    node.children?.forEach((child) => visit(child, nextBasis, nextGroupLabel));
  };

  nodes.forEach((node) => visit(node));
  return { groups: [...groups], natures: [...natures] };
}

export function filterTree(nodes: AnalysisNode[], filters: Filters, commentaries: Commentary[] = []) {
  const statuses = new Map(commentaries.map((row) => [row.analysisKey, row.status]));
  const visit = (node: AnalysisNode, groupKey = '', natureKey = ''): AnalysisNode | null => {
    const nextGroup = node.nodeType === 'COST_GROUP' ? node.key : groupKey;
    const nextNature = node.nodeType === 'NATURE' ? node.key : natureKey;
    const children = node.children?.map((child) => visit(child, nextGroup, nextNature)).filter((child): child is AnalysisNode => child !== null);
    const inScope = (!filters.group || nextGroup === filters.group) && (!filters.nature || nextNature === filters.nature);
    const material = !filters.materialOnly || node.materialityStatus === 'REQUIRES_EXPLANATION';
    const needsCommentary = !filters.needsCommentary || (node.materialityStatus === 'REQUIRES_EXPLANATION' && statuses.get(node.key) !== 'REVIEWED');
    if ((inScope && material && needsCommentary) || children?.length) return { ...node, children };
    return null;
  };
  return nodes.map((node) => visit(node)).filter((node): node is AnalysisNode => node !== null);
}

export function flattenVisible(nodes: AnalysisNode[], expanded: Set<string>, depth = 0): VisibleRow[] {
  return nodes.flatMap((node) => {
    const row = { ...node, depth, hasChildren: Boolean(node.children?.length) };
    return [row, ...(node.children?.length && expanded.has(node.key) ? flattenVisible(node.children, expanded, depth + 1) : [])];
  });
}

export function allExpandableKeys(nodes: AnalysisNode[]): string[] {
  return nodes.flatMap((node) => node.children?.length ? [node.key, ...allExpandableKeys(node.children)] : []);
}
