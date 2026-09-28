import { prisma } from '@/lib/prisma';
import { getCostFluctuationAnalysis } from '../analysis/service';
import type { ComparedNode, ComparisonType } from '../analysis/types';
import { evaluateNode, resolveRule } from './evaluate';
import type { MaterialityNode, MaterialityRuleValue } from './types';

export async function getMateriality(periodId: number, comparisonType: ComparisonType) {
  const analysis = await getCostFluctuationAnalysis(periodId, comparisonType);
  if (analysis.kind !== 'OK' || analysis.status !== 'AVAILABLE') return { ...analysis, materialityStatus: analysis.kind === 'OK' ? 'UNAVAILABLE' as const : undefined };
  const period = await prisma.costPeriod.findUniqueOrThrow({ where: { id: periodId }, select: { companyId: true, periodEnd: true } });
  const rules = await prisma.costMaterialityRule.findMany({ where: { companyId: period.companyId, comparisonType, active: true, validFrom: { lte: period.periodEnd }, OR: [{ validTo: null }, { validTo: { gte: period.periodEnd } }] } }) as unknown as MaterialityRuleValue[];
  const visit = (node: ComparedNode, groupId: number | null): MaterialityNode => {
    const currentGroup = node.nodeType === 'COST_GROUP' ? node.id : groupId;
    const overlay = node.nodeType === 'COMPANY' || currentGroup === null ? evaluateNode(node, null) : evaluateNode(node, resolveRule(rules, period.companyId, currentGroup, comparisonType, period.periodEnd));
    return { ...node, ...overlay, children: node.children?.map((child) => visit(child, currentGroup)) };
  };
  return { ...analysis, hierarchy: analysis.hierarchy.map((node) => visit(node, null)) };
}
