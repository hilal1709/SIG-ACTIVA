import { Prisma } from '@prisma/client';
import type { ComparedNode } from '../analysis/types';
import type { CriterionStatus, MaterialityNode, MaterialityRuleValue } from './types';

export class MaterialityConfigurationError extends Error {}

export function resolveRule(rules: MaterialityRuleValue[], companyId: number, groupId: number, comparisonType: MaterialityRuleValue['comparisonType'], effectiveAt: Date) {
  const effective = rules.filter((r) => r.companyId === companyId && r.comparisonType === comparisonType && r.validFrom <= effectiveAt && (!r.validTo || r.validTo >= effectiveAt));
  const exact = effective.filter((r) => r.costGroupId === groupId);
  const candidates = exact.length ? exact : effective.filter((r) => r.costGroupId === null);
  if (candidates.length > 1) throw new MaterialityConfigurationError('Ambiguous active materiality rules for analytical scope.');
  return candidates[0] ?? null;
}

function criterion(value: string | null, threshold: Prisma.Decimal | null): CriterionStatus {
  if (threshold === null) return 'NOT_CONFIGURED';
  if (value === null) return 'NOT_EVALUABLE';
  return new Prisma.Decimal(value).abs().gte(threshold) ? 'PASS' : 'FAIL';
}

export function evaluateNode(node: ComparedNode, rule: MaterialityRuleValue | null): Pick<MaterialityNode, 'materialityStatus' | 'ruleId' | 'ruleScope' | 'criteria' | 'thresholds'> {
  if (node.nodeType === 'COMPANY' || node.nodeType === 'ANALYSIS_BASIS') {
    return { materialityStatus: 'NOT_APPLICABLE', ruleId: null, ruleScope: null, criteria: { amount: 'NOT_CONFIGURED', percent: 'NOT_CONFIGURED' }, thresholds: { amount: null, percent: null, operator: null } };
  }
  if (!rule) return { materialityStatus: 'NOT_CONFIGURED', ruleId: null, ruleScope: null, criteria: { amount: 'NOT_CONFIGURED', percent: 'NOT_CONFIGURED' }, thresholds: { amount: null, percent: null, operator: null } };
  const amount = criterion(node.varianceAmount, rule.amountThreshold);
  const percent = criterion(node.variancePercentStatus === 'AVAILABLE' ? node.variancePercent : null, rule.percentThreshold);
  const configured = [amount, percent].filter((value) => value !== 'NOT_CONFIGURED');
  let materialityStatus: MaterialityNode['materialityStatus'];
  if (rule.operator === 'OR') materialityStatus = configured.includes('PASS') ? 'REQUIRES_EXPLANATION' : configured.includes('NOT_EVALUABLE') ? 'NOT_EVALUABLE' : 'NORMAL';
  else materialityStatus = configured.includes('FAIL') ? 'NORMAL' : configured.includes('NOT_EVALUABLE') ? 'NOT_EVALUABLE' : 'REQUIRES_EXPLANATION';
  return { materialityStatus, ruleId: rule.id, ruleScope: rule.costGroupId === null ? 'COMPANY' : 'COST_GROUP', criteria: { amount, percent }, thresholds: { amount: rule.amountThreshold?.toString() ?? null, percent: rule.percentThreshold?.toString() ?? null, operator: rule.operator } };
}
