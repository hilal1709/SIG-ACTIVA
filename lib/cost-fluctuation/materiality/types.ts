import type { Prisma } from '@prisma/client';
import type { ComparedNode, ComparisonType } from '../analysis/types';

export type MaterialityStatus = 'REQUIRES_EXPLANATION' | 'NORMAL' | 'NOT_CONFIGURED' | 'NOT_EVALUABLE' | 'UNAVAILABLE' | 'NOT_APPLICABLE';
export type CriterionStatus = 'PASS' | 'FAIL' | 'NOT_EVALUABLE' | 'NOT_CONFIGURED';
export interface MaterialityRuleValue { id: number; companyId: number; costGroupId: number | null; comparisonType: ComparisonType; amountThreshold: Prisma.Decimal | null; percentThreshold: Prisma.Decimal | null; operator: 'AND' | 'OR'; validFrom: Date; validTo: Date | null }
export interface MaterialityNode extends ComparedNode { materialityStatus: MaterialityStatus; ruleId: number | null; ruleScope: 'COST_GROUP' | 'COMPANY' | null; criteria: { amount: CriterionStatus; percent: CriterionStatus }; thresholds: { amount: string | null; percent: string | null; operator: 'AND' | 'OR' | null }; children?: MaterialityNode[] }
